import React from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { TMDBService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { Check, Star, Bookmark } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  aspect?: 'portrait' | 'compact';
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  userData,
  onClick,
}) => {
  const { openMovieDetail } = useCinema();

  const handleClick = () => {
    if (onClick) onClick();
    else openMovieDetail(movie.id);
  };

  const posterUrl = TMDBService.getPosterUrl(movie.posterPath, 'w342');
  const releaseYear = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const isWatched = userData?.status === 'watched';
  const isWatching = userData?.status === 'watching';
  const isWatchlist = userData?.status === 'want_to_watch';

  return (
    <div
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        userSelect: 'none',
        position: 'relative',
        width: '100%',
      }}
      className="movie-card-item"
    >
      {/* Poster Container */}
      <div
        className="poster-container"
        style={{
          border: isWatched ? '1px solid rgba(237, 194, 87, 0.4)' : '1px solid var(--cinema-border)',
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className="poster-img"
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              textAlign: 'center',
              color: 'var(--cinema-subtle)',
              fontSize: 12,
              background: 'linear-gradient(135deg, var(--cinema-charcoal), var(--cinema-deep-navy))',
            }}
          >
            {movie.title}
          </div>
        )}

        {/* Status Badges Overlay */}
        {isWatched && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: 'var(--cinema-gold)',
              color: 'var(--cinema-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              fontWeight: 800,
            }}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        )}

        {isWatching && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(39, 174, 96, 0.9)',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            ▶ WATCHING
          </div>
        )}

        {isWatchlist && !isWatched && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              color: 'var(--cinema-gold)',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
            }}
          >
            <Bookmark size={16} fill="var(--cinema-gold)" />
          </div>
        )}

        {/* User Rating badge if present */}
        {userData?.personalRating && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              backgroundColor: 'rgba(13, 13, 18, 0.85)',
              backdropFilter: 'blur(4px)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--cinema-gold)',
            }}
          >
            <Star size={10} fill="var(--cinema-gold)" strokeWidth={0} />
            <span>{userData.personalRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Title & Metadata Container (Guaranteed Strict Containment) */}
      <div className="w-full min-w-0 flex flex-col justify-between pt-1">
        <div className="min-h-[2.35rem] flex items-start">
          <h4
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cinema-white)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              lineHeight: 1.25,
            }}
            title={movie.title}
          >
            {movie.title}
          </h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--cinema-subtle)', marginTop: 4 }}>
          {releaseYear && <span>{releaseYear}</span>}
          {movie.voteAverage > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--cinema-gold)' }}>
              • ★ {movie.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
