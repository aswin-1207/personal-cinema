import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MovieWithUserData } from '../../types/movie';
import { TMDBService } from '../../services/tmdbService';
import { ShareService } from '../../services/shareService';
import { useCinema } from '../../context/CinemaContext';
import { Share2, Copy, Check, Star } from 'lucide-react';

interface ReviewShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MovieWithUserData;
}

export const ReviewShareModal: React.FC<ReviewShareModalProps> = ({ isOpen, onClose, item }) => {
  const { movie, userData } = item;
  const { showToast } = useCinema();
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const posterUrl = TMDBService.getPosterUrl(movie.posterPath, 'w342');
  const releaseYear = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const rating = userData?.personalRating;
  const review = userData?.review || '';
  const reviewTitle = userData?.reviewTitle || '';

  const shareText = `"${movie.title}" (${releaseYear}) — MyCinema Film Journal\n` +
    (typeof rating === 'number' ? `Score: ${rating.toFixed(1)} / 5.0 ⭐\n` : '') +
    (reviewTitle ? `"${reviewTitle}"\n\n` : '\n') +
    (review ? `${review}\n\n` : '') +
    `Tracked on MyCinema`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      showToast('Review text copied to clipboard!');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      showToast('Could not copy to clipboard');
    }
  };

  const handleNativeShare = async () => {
    const result = await ShareService.share({
      title: `${movie.title} • Film Reflection • MyCinema`,
      text: shareText,
      url: window.location.origin,
    });

    if (result.outcome === 'shared') {
      showToast('Shared successfully!');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Film Reflection"
      maxWidth={520}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#F5F3EB] border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedText ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
          </button>

          {ShareService.canNativeShare() && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="cinema-button-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Share2 size={13} />
              <span>Share via OS</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#9E9DA5]">
          You are explicitly sharing your personal written reflection and score:
        </p>

        {/* Share Preview Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#09090B] border border-[#E0AD52]/30 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 aspect-[2/3] rounded-lg overflow-hidden bg-[#181822] flex-shrink-0">
              {posterUrl ? (
                <img src={posterUrl} alt="" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-serif font-bold text-sm text-[#F5F3EB] truncate">
                {movie.title}
              </h4>
              <p className="text-xs text-[#9E9DA5] font-mono">
                {releaseYear} • Personal Screening Reflection
              </p>
            </div>
            {typeof rating === 'number' && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E0AD52]/15 border border-[#E0AD52]/30 flex-shrink-0">
                <Star size={13} className="text-[#E0AD52] fill-[#E0AD52]" />
                <span className="text-xs font-bold text-[#E0AD52] font-mono">
                  {rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {reviewTitle && (
            <h5 className="font-serif italic text-xs font-bold text-[#E0AD52]">
              "{reviewTitle}"
            </h5>
          )}

          {review && (
            <p className="text-xs text-[#F5F3EB]/85 leading-relaxed line-clamp-4 italic border-l-2 border-[#E0AD52]/40 pl-3">
              "{review}"
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] text-[#63626B] font-mono">
            <span>MYCINEMA • PRIVATE FILM VAULT</span>
            <span>PERSONAL JOURNAL</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
