import React, { useState } from 'react';
import { MovieWithUserData } from '../../types/movie';
import { TMDBService } from '../../services/tmdbService';
import { Star, Heart, Clock, AlertTriangle, ChevronRight } from 'lucide-react';

interface ReviewCardProps {
  item: MovieWithUserData;
  onOpenDetail: () => void;
  onEdit: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ item, onOpenDetail, onEdit }) => {
  const { movie, userData } = item;
  const [revealSpoiler, setRevealSpoiler] = useState(false);

  const posterUrl = TMDBService.getPosterUrl(movie.posterPath, 'w342');
  const releaseYear = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const hasReview = Boolean(userData?.review && userData.review.trim().length > 0);
  const rating = userData?.personalRating;

  const watchedDateStr = userData?.watchedAt
    ? new Date(userData.watchedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const reviewDateStr = userData?.reviewedAt
    ? new Date(userData.reviewedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      onClick={onOpenDetail}
      className="group relative flex flex-col sm:flex-row gap-3.5 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-[#131319] hover:bg-[#181822] border border-white/[0.07] hover:border-[#E0AD52]/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-2xl overflow-hidden"
    >
      {/* Poster Thumbnail */}
      <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-[#09090B] border border-white/10 flex-shrink-0 relative">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#63626B] font-mono">
            No Art
          </div>
        )}

        {userData?.isFavorite && (
          <span className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[#B3262E]/90 text-white backdrop-blur-md">
            <Heart size={10} className="fill-white" />
          </span>
        )}
      </div>

      {/* Entry Details */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Header Row: Title, Year, Rating */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif font-bold text-sm sm:text-base text-[#F5F3EB] group-hover:text-[#E0AD52] transition-colors truncate">
                {movie.title}
              </h3>
              {releaseYear && (
                <span className="text-xs text-[#9E9DA5] font-mono">
                  {releaseYear}
                </span>
              )}
            </div>

            {/* Rating Stars */}
            {typeof rating === 'number' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E0AD52]/10 border border-[#E0AD52]/20 flex-shrink-0">
                <Star size={12} className="text-[#E0AD52] fill-[#E0AD52]" />
                <span className="text-xs font-bold text-[#E0AD52] font-mono">
                  {rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Review Headline & Excerpt */}
          {hasReview ? (
            <div className="mt-2.5 space-y-1">
              {userData?.reviewTitle && (
                <h4 className="text-xs font-bold text-[#E0AD52]/90 line-clamp-1 italic">
                  "{userData.reviewTitle}"
                </h4>
              )}

              {/* Spoiler Guard */}
              {userData?.hasSpoilers && !revealSpoiler ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealSpoiler(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#09090B]/80 border border-amber-500/30 flex items-center gap-2 cursor-pointer hover:bg-[#09090B]"
                >
                  <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                  <span className="text-[11px] text-amber-200/90 font-medium truncate">
                    Review contains spoilers • Click to reveal
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[#F5F3EB]/80 leading-relaxed line-clamp-2 sm:line-clamp-3">
                  {userData?.review}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-[#9E9DA5]/70 italic flex items-center gap-1.5">
              <span>Scored without written review</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-[11px] text-[#E0AD52] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                + Write thoughts
              </button>
            </div>
          )}
        </div>

        {/* Footer Meta Row */}
        <div className="flex items-center justify-between text-[11px] text-[#63626B] font-mono pt-3 border-t border-white/[0.04] mt-2">
          <div className="flex items-center gap-3">
            {watchedDateStr && (
              <span className="flex items-center gap-1" title="Date Watched">
                <Clock size={11} />
                <span>Watched {watchedDateStr}</span>
              </span>
            )}
            {reviewDateStr && (
              <span className="hidden xs:flex items-center gap-1" title="Date Reviewed">
                <span>• Reviewed {reviewDateStr}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[#E0AD52] font-sans font-semibold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Read</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>
    </div>
  );
};
