import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { MovieNightRepository } from '../db/repositories/movieNightRepository';
import { MovieRepository } from '../db/repositories/movieRepository';
import { MovieNight, Movie } from '../types/movie';
import { tmdbService } from '../services/tmdbService';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Film,
  Sparkles,
} from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const { openMovieDetail, showToast, dataVersion, notifyDataChanged } = useCinema();

  const [upcomingNights, setUpcomingNights] = useState<
    Array<MovieNight & { movie?: Movie }>
  >([]);
  const [libraryMovies, setLibraryMovies] = useState<Movie[]>([]);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Form fields
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [scheduledTime, setScheduledTime] = useState<string>('20:00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    const upcoming = await MovieNightRepository.getUpcoming();
    setUpcomingNights(upcoming);

    const lib = await MovieRepository.getAll();
    setLibraryMovies(lib);
    if (lib.length > 0 && !selectedMovieId) {
      setSelectedMovieId(lib[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, [dataVersion]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovieId) {
      alert('Please select a movie to schedule.');
      return;
    }

    try {
      setIsSubmitting(true);
      await MovieNightRepository.schedule({
        movieId: selectedMovieId,
        date: scheduledDate,
        time: scheduledTime,
        notes,
      });

      showToast('Movie Night scheduled!');
      setIsScheduleOpen(false);
      setNotes('');
      notifyDataChanged();
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await MovieNightRepository.delete(id);
    showToast('Movie Night removed.');
    notifyDataChanged();
    loadData();
  };

  const handleMarkDone = async (night: MovieNight) => {
    night.status = 'completed';
    await MovieNightRepository.update(night);
    showToast('Screening completed!');
    notifyDataChanged();
    loadData();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-cinema-gold font-semibold mb-1">
            Planned Screenings
          </div>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-cinema-white">
            Cinema Calendar
          </h1>
          <p className="text-xs text-cinema-subtle mt-1">
            Plan movie nights and schedule your next home theater screening.
          </p>
        </div>

        <button
          onClick={() => setIsScheduleOpen(true)}
          className="cinema-button-primary px-5 py-2.5 text-xs flex items-center gap-1.5 shadow-gold self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Schedule Movie Night</span>
        </button>
      </div>

      {/* Upcoming Screenings Section */}
      <section className="space-y-4">
        <h3 className="font-serif font-bold text-xl text-cinema-white flex items-center gap-2">
          <Sparkles size={18} className="text-cinema-gold" />
          <span>Upcoming Screenings</span>
        </h3>

        {upcomingNights.length === 0 ? (
          <EmptyState
            title="No Screenings Scheduled"
            description="Pick a film from your library or watchlist and set a movie night date."
            actionText="Schedule Tonight"
            onAction={() => setIsScheduleOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingNights.map((night) => {
              const movie = night.movie;
              const poster = movie?.posterPath
                ? tmdbService.getImageUrl(movie.posterPath, 'w185')
                : null;

              const isToday =
                night.date === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={night.id}
                  className={`p-4 rounded-2xl border flex gap-4 items-center justify-between transition-all ${
                    isToday
                      ? 'border-cinema-gold/60 bg-cinema-gold/5 shadow-gold'
                      : 'border-white/5 bg-cinema-surface/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Poster */}
                    <div
                      onClick={() => movie && openMovieDetail(movie.id)}
                      className="w-16 h-24 rounded-xl overflow-hidden bg-cinema-charcoal flex-shrink-0 cursor-pointer shadow-md border border-white/10"
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-cinema-subtle">
                          <Film size={20} />
                        </div>
                      )}
                    </div>

                    {/* Info with Strict Boundary Containment */}
                    <div className="min-w-0 flex-1 pr-2">
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-cinema-gold text-cinema-black text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">
                          Tonight
                        </span>
                      )}
                      <h4
                        onClick={() => movie && openMovieDetail(movie.id)}
                        className="font-serif font-bold text-base text-cinema-white cursor-pointer hover:text-cinema-gold transition-colors line-clamp-2 break-words"
                        title={movie?.title}
                      >
                        {movie?.title || 'Unknown Title'}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-cinema-silver mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={12} className="text-cinema-gold" />
                          <span>{night.date}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-cinema-gold" />
                          <span>{night.time}</span>
                        </span>
                      </div>

                      {night.notes && (
                        <p className="text-xs text-cinema-subtle italic mt-1 line-clamp-1 truncate">
                          "{night.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleMarkDone(night)}
                      className="p-2 rounded-lg bg-cinema-surface hover:bg-cinema-gold hover:text-cinema-black text-cinema-silver border border-white/5 transition-colors"
                      title="Mark Screening Complete"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(night.id)}
                      className="p-2 rounded-lg bg-cinema-surface hover:bg-cinema-crimson/20 text-cinema-subtle hover:text-cinema-crimson border border-white/5 transition-colors"
                      title="Cancel Movie Night"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Schedule Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Movie Night"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
              Select Film from Library
            </label>
            {libraryMovies.length === 0 ? (
              <p className="text-xs text-cinema-subtle">
                No movies in your library yet. Add or discover movies first!
              </p>
            ) : (
              <select
                value={selectedMovieId || ''}
                onChange={(e) => setSelectedMovieId(Number(e.target.value))}
                className="cinema-input w-full"
                required
              >
                {libraryMovies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} {m.releaseDate ? `(${m.releaseDate.substring(0, 4)})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
                Screening Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="cinema-input w-full text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="cinema-input w-full text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
              Screening Notes / Audience (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Home theater popcorn night with friends"
              className="cinema-input w-full text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsScheduleOpen(false)}
              className="cinema-button-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedMovieId}
              className="cinema-button-primary px-5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Confirm Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
