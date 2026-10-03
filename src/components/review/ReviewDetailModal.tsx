import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MovieWithUserData } from '../../types/movie';
import { TMDBService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { ReviewRepository } from '../../db/repositories/reviewRepository';
import {
  Star,
  Heart,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  Share2,
  Film,
} from 'lucide-react';

interface ReviewDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MovieWithUserData;
  onEdit: () => void;
  onShare: () => void;
  onDeleted?: () => void;
}

export const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onEdit,
  onShare,
  onDeleted,
}) => {
  const { movie, userData } = item;
  const { showToast, notifyDataChanged, openMovieDetail } = useCinema();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const posterUrl = TMDBService.getPosterUrl(movie.posterPath, 'w500');
  const backdropUrl = TMDBService.getBackdropUrl(movie.backdropPath, 'w1280');
  const releaseYear = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const rating = userData?.personalRating;
  const hasReview = Boolean(userData?.review && userData.review.trim().length > 0);

  const watchedDateStr = userData?.watchedAt
    ? new Date(userData.watchedAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const reviewedDateStr = userData?.reviewedAt
    ? new Date(userData.reviewedAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const handleDelete = async () => {
    if (!window.confirm(`Delete the written review for "${movie.title}"? Your score and watched status will remain intact.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await ReviewRepository.deleteReview(movie.id);
      notifyDataChanged();
      showToast('Written review deleted.');
      if (onDeleted) onDeleted();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete review:', err);
      showToast('Could not delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={640}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                openMovieDetail(movie.id);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/5 border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Film size={13} />
              <span className="hidden sm:inline">Movie Details</span>
            </button>

            {hasReview && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Delete written review"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onShare}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#F5F3EB] hover:text-[#E0AD52] hover:bg-white/5 border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Share review"
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>

            <button
              onClick={onEdit}
              className="cinema-button-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Edit3 size={13} />
              <span>{hasReview ? 'Edit Journal' : 'Write Journal'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Cinematic Backdrop Banner */}
        <div className="relative -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 h-36 sm:h-44 bg-[#09090B] overflow-hidden rounded-t-[24px] sm:rounded-t-2xl">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt=""
              className="w-full h-full object-cover object-center filter brightness-[0.65] contrast-[1.1]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#181824] to-[#09090B]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131319] via-[#131319]/40 to-transparent" />

          {/* Quick Header Badge */}
          <div className="absolute top-3.5 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#09090B]/80 text-[#E0AD52] border border-[#E0AD52]/30 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
              Film Journal
            </span>
          </div>
        </div>

        {/* Movie Info Header */}
        <div className="flex gap-4 items-start -mt-12 sm:-mt-14 relative z-10">
          <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-[#09090B] border-2 border-white/10 shadow-2xl flex-shrink-0">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>

          <div className="flex-1 min-w-0 pt-2 sm:pt-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-base sm:text-xl text-[#F5F3EB] leading-tight">
                  {movie.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-[#9E9DA5] font-mono">
                  {releaseYear && <span>{releaseYear}</span>}
                  {movie.runtime && <span>• {movie.runtime}m</span>}
                  {userData?.isFavorite && (
                    <span className="flex items-center gap-1 text-red-400 font-sans font-semibold">
                      <Heart size={11} className="fill-red-400" />
                      <span>Favorite</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Star Rating Badge */}
              {typeof rating === 'number' && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E0AD52]/15 border border-[#E0AD52]/30 flex-shrink-0">
                  <Star size={15} className="text-[#E0AD52] fill-[#E0AD52]" />
                  <span className="text-sm font-bold text-[#E0AD52] font-mono">
                    {rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Title / Headline */}
        {userData?.reviewTitle && (
          <div className="border-l-2 border-[#E0AD52] pl-3.5 py-0.5">
            <h4 className="italic text-base sm:text-lg text-[#F5F3EB] font-semibold">
              "{userData.reviewTitle}"
            </h4>
          </div>
        )}

        {/* Review Content Body */}
        {hasReview ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E0E14] border border-white/[0.06] text-xs sm:text-sm text-[#F5F3EB]/90 leading-relaxed font-sans whitespace-pre-wrap">
            {userData?.review}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#0E0E14] border border-white/[0.05] text-xs text-[#9E9DA5] italic">
            This entry has a personal star score, but no written reflection yet.
          </div>
        )}

        {/* Private Notes if Present */}
        {userData?.notes && (
          <div className="p-3.5 rounded-xl bg-[#0E0E14]/60 border border-white/[0.04] space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[#63626B] font-bold block">
              Private Screening Notes
            </span>
            <p className="text-xs text-[#9E9DA5]">{userData.notes}</p>
          </div>
        )}

        {/* Meta Timestamps */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#63626B] font-mono pt-2 border-t border-white/[0.06]">
          {watchedDateStr && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>Watched on {watchedDateStr}</span>
            </div>
          )}
          {reviewedDateStr && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>Recorded on {reviewedDateStr}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
