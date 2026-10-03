import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Movie, UserMovie } from '../../types/movie';
import { TMDBService } from '../../services/tmdbService';
import { RatingControl } from '../movie/RatingControl';
import { useCinema } from '../../context/CinemaContext';
import { ReviewRepository } from '../../db/repositories/reviewRepository';
import { Trash2, Save, RotateCcw } from 'lucide-react';

interface ReviewEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie;
  initialUserData?: UserMovie | null;
  onSaved?: () => void;
}

export const ReviewEditorModal: React.FC<ReviewEditorModalProps> = ({
  isOpen,
  onClose,
  movie,
  initialUserData,
  onSaved,
}) => {
  const { showToast, notifyDataChanged } = useCinema();

  const [rating, setRating] = useState<number | null>(null);
  const [reviewTitle, setReviewTitle] = useState<string>('');
  const [reviewText, setReviewText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasDraftRestored, setHasDraftRestored] = useState<boolean>(false);

  const draftKey = `mycinema_draft_review_${movie.id}`;

  useEffect(() => {
    if (!isOpen) return;

    // Check for existing draft in local storage
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setReviewTitle(parsed.title || '');
        setReviewText(parsed.text || '');
        setRating(typeof parsed.rating === 'number' ? parsed.rating : initialUserData?.personalRating ?? null);
        setHasDraftRestored(true);
        return;
      } catch {
        // Fallback to initial user data
      }
    }

    // Populate from existing user data
    setRating(initialUserData?.personalRating ?? null);
    setReviewTitle(initialUserData?.reviewTitle || '');
    setReviewText(initialUserData?.review || '');
    setHasDraftRestored(false);
  }, [isOpen, movie.id, initialUserData]);

  // Auto-save draft as user types
  const handleTextChange = (text: string) => {
    setReviewText(text);
    if (text.trim().length > 0 || reviewTitle.trim().length > 0) {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title: reviewTitle,
          text,
          rating,
          timestamp: Date.now(),
        })
      );
    }
  };

  const handleTitleChange = (title: string) => {
    setReviewTitle(title);
    if (title.trim().length > 0 || reviewText.trim().length > 0) {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          text: reviewText,
          rating,
          timestamp: Date.now(),
        })
      );
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem(draftKey);
    setReviewTitle(initialUserData?.reviewTitle || '');
    setReviewText(initialUserData?.review || '');
    setRating(initialUserData?.personalRating ?? null);
    setHasDraftRestored(false);
    showToast('Draft discarded. Restored original record.');
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      await ReviewRepository.saveReview(movie.id, {
        rating,
        reviewTitle: reviewTitle.trim() || undefined,
        reviewText: reviewText.trim() || undefined,
      });

      // Clear draft on successful save
      localStorage.removeItem(draftKey);
      notifyDataChanged();
      showToast(`Saved reflection for "${movie.title}"`);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save review:', err);
      showToast('Storage error: could not save review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!window.confirm('Delete this written review? (Your watched status and score will be kept)')) {
      return;
    }

    try {
      await ReviewRepository.deleteReview(movie.id);
      localStorage.removeItem(draftKey);
      notifyDataChanged();
      showToast('Written review removed.');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete review:', err);
      showToast('Could not delete review');
    }
  };

  const posterUrl = TMDBService.getPosterUrl(movie.posterPath, 'w185');
  const releaseYear = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const existingHasReview = Boolean(initialUserData?.review && initialUserData.review.trim().length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingHasReview ? 'Edit Film Journal' : 'Write Film Journal'}
      maxWidth={580}
      footer={
        <div className="flex items-center justify-between w-full">
          {existingHasReview ? (
            <button
              type="button"
              onClick={handleDeleteReview}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/5 transition-colors cursor-pointer border border-transparent"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="cinema-button-primary px-4 py-1.5 text-xs font-bold flex items-center gap-2 shadow-lg"
            >
              <Save size={13} />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Movie Header Bar */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#09090B]/60 border border-white/[0.06]">
          <div className="w-12 aspect-[2/3] rounded-lg overflow-hidden bg-[#181822] flex-shrink-0">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm text-[#F5F3EB] truncate">
              {movie.title}
            </h4>
            <p className="text-xs text-[#9E9DA5] font-mono mt-0.5">
              {releaseYear ? `${releaseYear} • ` : ''}Personal Cinema Journal
            </p>
          </div>

          {hasDraftRestored && (
            <button
              onClick={handleClearDraft}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/20 cursor-pointer"
              title="Discard restored draft"
            >
              <RotateCcw size={11} />
              <span>Reset Draft</span>
            </button>
          )}
        </div>

        {/* Rating Row (Optional) */}
        <div className="p-3 rounded-xl bg-[#0E0E14] border border-white/[0.05] flex items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold block">
              Personal Rating
            </span>
            <span className="text-[11px] text-[#63626B]">
              Optional 0.5 to 5.0 score
            </span>
          </div>

          <div className="flex items-center gap-2">
            <RatingControl
              value={rating}
              onChange={(r) => setRating(r)}
              size={22}
            />
            {typeof rating === 'number' && (
              <button
                onClick={() => setRating(null)}
                className="text-[11px] text-[#9E9DA5] hover:text-[#B3262E] transition-colors p-1 cursor-pointer bg-transparent border-none"
                title="Clear score"
                aria-label="Clear rating"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Review Title Input (Optional Headline) */}
        <div className="space-y-1.5">
          <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
            Headline / Key Takeaway <span className="text-[#63626B] font-normal lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={reviewTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. A haunting masterclass in atmospheric tension"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E14] border border-white/10 text-xs sm:text-sm text-[#F5F3EB] placeholder-[#63626B] focus:border-[#E0AD52] focus:outline-none transition-colors"
          />
        </div>

        {/* Main Review Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
              Written Reflection / Journal
            </label>
            <span className="text-[11px] text-[#63626B] font-mono">
              {reviewText.length} characters
            </span>
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Record what struck you about the filmmaking, performances, themes, or how this film made you feel..."
            rows={5}
            className="w-full p-3.5 rounded-xl bg-[#0E0E14] border border-white/10 text-xs sm:text-sm text-[#F5F3EB] placeholder-[#63626B] leading-relaxed focus:border-[#E0AD52] focus:outline-none transition-colors resize-y min-h-[120px]"
          />
        </div>
      </div>
    </Modal>
  );
};
