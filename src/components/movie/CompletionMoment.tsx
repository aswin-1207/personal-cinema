import React, { useState, useEffect } from 'react';
import { useCinema } from '../../context/CinemaContext';
import { TMDBService } from '../../services/tmdbService';
import { RatingControl } from './RatingControl';
import { CheckCircle, Share2, Feather, X } from 'lucide-react';
import { UserMovieRepository } from '../../db/repositories/userMovieRepository';

export const CompletionMoment: React.FC = () => {
  const { celebrationMovie, dismissCelebrationMovie, setRating, setReviewAndNotes, openMovieDetail } = useCinema();
  const [rating, setLocalRating] = useState<number | null>(null);
  const [showNoteEditor, setShowNoteEditor] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (celebrationMovie) {
      UserMovieRepository.getByMovieId(celebrationMovie.id).then((um) => {
        setLocalRating(um?.personalRating ?? null);
        setNotes(um?.notes || um?.review || '');
      });
      setShowNoteEditor(false);
    }
  }, [celebrationMovie]);

  if (!celebrationMovie) return null;

  const posterUrl = TMDBService.getPosterUrl(celebrationMovie.posterPath, 'w500');

  const handleRatingChange = async (newRating: number) => {
    setLocalRating(newRating);
    await setRating(celebrationMovie.id, newRating);
  };

  const handleSaveNotes = async () => {
    await setReviewAndNotes(celebrationMovie.id, { review: notes, notes });
    setShowNoteEditor(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 5, 8, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeInOverlay 0.3s ease-out',
      }}
      onClick={dismissCelebrationMovie}
    >
      <div
        className="cinema-glass"
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(237, 194, 87, 0.2)',
          border: '1px solid var(--cinema-gold)',
          animation: 'scaleInCard 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={dismissCelebrationMovie}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            color: 'var(--cinema-subtle)',
            cursor: 'pointer',
            padding: 6,
          }}
        >
          <X size={20} />
        </button>

        {/* Poster with Gold Ambient Glow and Light Sweep */}
        <div
          className="light-sweep-container"
          style={{
            width: 140,
            aspectRatio: '2 / 3',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 25px var(--cinema-gold-glow)',
            marginBottom: 20,
            overflow: 'hidden',
            border: '1px solid var(--cinema-gold)',
          }}
        >
          {posterUrl ? (
            <img src={posterUrl} alt={celebrationMovie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--cinema-charcoal)' }} />
          )}
        </div>

        {/* Cinematic Watched Banner */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(237, 194, 87, 0.15)',
            color: 'var(--cinema-gold)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}
        >
          <CheckCircle size={15} />
          <span>✓ WATCHED</span>
        </div>

        <h3
          className="title-display"
          style={{ fontSize: 18, color: 'var(--cinema-white)', marginBottom: 4 }}
        >
          {celebrationMovie.title}
        </h3>

        <p style={{ fontSize: 13, color: 'var(--cinema-silver)', fontStyle: 'italic', marginBottom: 20 }}>
          "Another one in the books."
        </p>

        {/* Interactive 5-star rating */}
        <div style={{ marginBottom: 20 }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>
            Rate This Film
          </div>
          <RatingControl value={rating} onChange={handleRatingChange} size={30} />
        </div>

        {/* Note / Review Input Section */}
        {showNoteEditor ? (
          <div style={{ width: '100%', marginBottom: 16 }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What were your thoughts on this screening?"
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--cinema-charcoal)',
                border: '1px solid var(--cinema-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--cinema-white)',
                padding: 10,
                fontSize: 13,
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowNoteEditor(false)}>
                Cancel
              </button>
              <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={handleSaveNotes}>
                Save Note
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, width: '100%' }}>
            <button
              className="btn-ghost"
              style={{ flex: 1, fontSize: 13, padding: '10px 8px' }}
              onClick={() => setShowNoteEditor(true)}
            >
              <Feather size={14} />
              <span>{notes ? 'Edit Review' : 'Add Review'}</span>
            </button>
            <button
              className="btn-ghost"
              style={{ flex: 1, fontSize: 13, padding: '10px 8px' }}
              onClick={() => {
                dismissCelebrationMovie();
                openMovieDetail(celebrationMovie.id);
              }}
            >
              <Share2 size={14} />
              <span>Details & Share</span>
            </button>
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={dismissCelebrationMovie}
        >
          CONTINUE BROWSING
        </button>
      </div>

      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInCard {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
