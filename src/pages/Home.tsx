import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { tmdbService } from '../services/tmdbService';
import { MovieWithUserData, Movie } from '../types/movie';
import { Collection } from '../types/collection';
import { MovieCard } from '../components/movie/MovieCard';
import { CollectionCard } from '../components/collection/CollectionCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { EmptyState } from '../components/common/EmptyState';
import { WatchedButton } from '../components/movie/WatchedButton';
import { Play, Sparkles, Film, Clock, Flame, Star } from 'lucide-react';

export const Home: React.FC = () => {
  const {
    openMovieDetail,
    openCollectionDetail,
    setActiveTab,
    preferences,
    dataVersion,
  } = useCinema();

  const [heroMovie, setHeroMovie] = useState<MovieWithUserData | null>(null);
  const [continueWatching, setContinueWatching] = useState<MovieWithUserData[]>([]);
  const [watchlist, setWatchlist] = useState<MovieWithUserData[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<MovieWithUserData[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<{ totalWatched: number; totalHours: number; streak: number }>({
    totalWatched: 0,
    totalHours: 0,
    streak: 0,
  });

  // Surprise Me Random Movie Modal state
  const [surpriseMovie, setSurpriseMovie] = useState<Movie | null>(null);
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        const allLibrary = await UserMovieRepository.getAllWithMovies();

        const watchingList = allLibrary.filter((m) => m.userData?.status === 'watching');
        const watchListItems = allLibrary.filter((m) => m.userData?.status === 'want_to_watch');
        const watchedListItems = allLibrary
          .filter((m) => m.userData?.status === 'watched')
          .sort((a, b) => {
            const dateA = a.userData?.watchedAt || '';
            const dateB = b.userData?.watchedAt || '';
            return dateB.localeCompare(dateA);
          });

        const allCollections = await CollectionRepository.getAll();

        // Calculate hours and streak
        let minutes = 0;
        watchedListItems.forEach((item) => {
          minutes += item.movie.runtime || 110;
        });
        const hours = Math.round((minutes / 60) * 10) / 10;

        // Choose Hero: first watching movie, or first watchlist item, or latest trending
        let chosenHero: MovieWithUserData | null = null;
        if (watchingList.length > 0) {
          chosenHero = watchingList[0];
        } else if (watchListItems.length > 0) {
          chosenHero = watchListItems[0];
        } else if (allLibrary.length > 0) {
          chosenHero = allLibrary[0];
        } else {
          // If library is brand new, fetch a trending movie for hero
          const trending = await tmdbService.getTrending('week');
          if (trending.length > 0) {
            chosenHero = { movie: trending[0] };
          }
        }

        if (isMounted) {
          setHeroMovie(chosenHero);
          setContinueWatching(watchingList);
          setWatchlist(watchListItems);
          setRecentlyWatched(watchedListItems);
          setCollections(allCollections);
          setStats({
            totalWatched: watchedListItems.length,
            totalHours: hours,
            streak: watchedListItems.length > 0 ? 1 : 0,
          });
        }
      } catch (err) {
        console.error('Failed to load home data:', err);
      }
    }

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  // Greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EVENING';
  const userName = preferences.displayName || 'ASWIN';

  const handleSurpriseMe = async () => {
    setIsSurpriseOpen(true);
    setIsRolling(true);

    const candidates = watchlist.length > 0 ? watchlist : await UserMovieRepository.getAllWithMovies();
    if (candidates.length > 0) {
      // Pick random
      const randomIdx = Math.floor(Math.random() * candidates.length);
      setTimeout(() => {
        setSurpriseMovie(candidates[randomIdx].movie);
        setIsRolling(false);
      }, 700);
    } else {
      // Fetch trending
      const trending = await tmdbService.getTrending('week');
      const randomIdx = Math.floor(Math.random() * trending.length);
      setTimeout(() => {
        setSurpriseMovie(trending[randomIdx]);
        setIsRolling(false);
      }, 700);
    }
  };

  const heroBackdrop = heroMovie?.movie.backdropPath
    ? tmdbService.getImageUrl(heroMovie.movie.backdropPath, 'original')
    : heroMovie?.movie.posterPath
    ? tmdbService.getImageUrl(heroMovie.movie.posterPath, 'w780')
    : null;

  return (
    <div className="pb-20 space-y-10">
      {/* Hero Section */}
      <div className="relative -mx-4 -mt-6 sm:-mx-8 sm:-mt-8 h-[68vh] min-h-[460px] max-h-[640px] bg-cinema-black overflow-hidden flex items-end">
        {/* Backdrop Image */}
        {heroBackdrop && (
          <img
            src={heroBackdrop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.1] transform scale-105"
          />
        )}

        {/* Ambient Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-cinema-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-cinema-black/80 via-transparent to-cinema-black/40" />

        {/* Hero Content */}
        <div className="relative z-10 w-full px-6 sm:px-12 pb-10 max-w-5xl">
          {/* Greeting Tag */}
          <div className="flex items-center gap-2 text-cinema-gold text-xs sm:text-sm font-semibold tracking-widest uppercase mb-2 animate-fade-in">
            <Sparkles size={14} className="text-cinema-gold" />
            <span>
              GOOD {timeOfDay}, {userName}. WHAT ARE WE WATCHING?
            </span>
          </div>

          {heroMovie ? (
            <div>
              <h1 className="font-serif font-extrabold text-3xl sm:text-5xl md:text-6xl text-cinema-white tracking-tight drop-shadow-lg mb-3">
                {heroMovie.movie.title}
              </h1>

              {/* Metadata strip */}
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-cinema-silver mb-4 drop-shadow">
                {heroMovie.movie.releaseDate && (
                  <span>{heroMovie.movie.releaseDate.substring(0, 4)}</span>
                )}
                {heroMovie.movie.runtime && <span>• {heroMovie.movie.runtime} min</span>}
                {heroMovie.movie.genres && heroMovie.movie.genres.length > 0 && (
                  <span>• {heroMovie.movie.genres.slice(0, 2).map((g) => g.name).join(', ')}</span>
                )}
                {heroMovie.movie.voteAverage > 0 && (
                  <span className="flex items-center gap-1 text-cinema-gold font-semibold">
                    <Star size={13} className="fill-cinema-gold text-cinema-gold" />
                    <span>{heroMovie.movie.voteAverage.toFixed(1)}</span>
                  </span>
                )}
              </div>

              {heroMovie.movie.overview && (
                <p className="text-xs sm:text-sm text-cinema-silver/90 max-w-2xl line-clamp-2 sm:line-clamp-3 mb-6 leading-relaxed drop-shadow">
                  {heroMovie.movie.overview}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openMovieDetail(heroMovie.movie.id)}
                  className="cinema-button-primary px-6 py-3 flex items-center gap-2 text-sm font-semibold shadow-gold"
                >
                  <Play size={16} className="fill-cinema-black" />
                  <span>View Details</span>
                </button>

                <WatchedButton
                  movie={heroMovie.movie}
                  userData={heroMovie.userData}
                  style="pill"
                />

                <button
                  onClick={handleSurpriseMe}
                  className="cinema-button-secondary px-4 py-3 flex items-center gap-2 text-sm backdrop-blur-md"
                >
                  <Sparkles size={16} />
                  <span>Surprise Me</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-cinema-silver">
              <h2 className="font-serif text-3xl font-bold text-cinema-white mb-2">Welcome to Personal Cinema</h2>
              <p className="text-sm max-w-lg mb-4">
                Your private cinematic haven for tracking and exploring movies. Start by discovering movies or
                importing your existing collection.
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="cinema-button-primary px-6 py-2.5 text-sm"
              >
                Discover Movies
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Quick Strip */}
      <div className="grid grid-cols-3 gap-3 bg-cinema-surface/50 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-cinema-gold/10 border border-cinema-gold/20 flex items-center justify-center text-cinema-gold">
            <Film size={20} />
          </div>
          <div>
            <div className="text-xs text-cinema-subtle">Watched</div>
            <div className="font-bold text-cinema-white text-base sm:text-lg">
              {stats.totalWatched} {stats.totalWatched === 1 ? 'Film' : 'Films'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 border-x border-white/5">
          <div className="w-10 h-10 rounded-xl bg-cinema-gold/10 border border-cinema-gold/20 flex items-center justify-center text-cinema-gold">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs text-cinema-subtle">Screen Time</div>
            <div className="font-bold text-cinema-white text-base sm:text-lg">
              {stats.totalHours} hrs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-cinema-gold/10 border border-cinema-gold/20 flex items-center justify-center text-cinema-gold">
            <Flame size={20} />
          </div>
          <div>
            <div className="text-xs text-cinema-subtle">Curated Cols</div>
            <div className="font-bold text-cinema-white text-base sm:text-lg">
              {collections.length}
            </div>
          </div>
        </div>
      </div>

      {/* Continue Watching Section (Status = watching) */}
      {continueWatching.length > 0 && (
        <section>
          <SectionHeader
            title="Currently Watching"
            subtitle="Movies in progress"
            actionLabel="View All"
            onAction={() => setActiveTab('library')}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {continueWatching.map((item) => (
              <MovieCard
                key={item.movie.id}
                movie={item.movie}
                userData={item.userData}
                onClick={() => openMovieDetail(item.movie.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Watchlist Section */}
      <section>
        <SectionHeader
          title="On Your Watchlist"
          subtitle="Films queued up for your next screening"
          actionLabel="View Library"
          onAction={() => setActiveTab('library')}
        />
        {watchlist.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {watchlist.slice(0, 10).map((item) => (
              <MovieCard
                key={item.movie.id}
                movie={item.movie}
                userData={item.userData}
                onClick={() => openMovieDetail(item.movie.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your Watchlist is Empty"
            description="Explore trending films and add what catches your eye."
            actionLabel="Discover Movies"
            onAction={() => setActiveTab('discover')}
          />
        )}
      </section>

      {/* Curated Collections Section */}
      <section>
        <SectionHeader
          title="Curated Collections"
          subtitle="Thematic sets and cinematic marathons"
          actionLabel="All Collections"
          onAction={() => setActiveTab('collections')}
        />
        {collections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {collections.slice(0, 6).map((col) => (
              <CollectionCard
                key={col.id}
                collection={col}
                onClick={() => openCollectionDetail(col.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Create Custom Collections"
            description="Organize your films by director, franchise, or mood."
            actionLabel="Explore Collections"
            onAction={() => setActiveTab('collections')}
          />
        )}
      </section>

      {/* Recently Watched Section */}
      {recentlyWatched.length > 0 && (
        <section>
          <SectionHeader
            title="Recently Watched"
            subtitle="Your latest logged screenings"
            actionLabel="View History"
            onAction={() => setActiveTab('library')}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {recentlyWatched.slice(0, 10).map((item) => (
              <MovieCard
                key={item.movie.id}
                movie={item.movie}
                userData={item.userData}
                onClick={() => openMovieDetail(item.movie.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Surprise Me Modal */}
      {isSurpriseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cinema-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-cinema-surface border border-cinema-gold/40 rounded-2xl shadow-2xl p-6 text-center animate-scale-in">
            <div className="inline-flex p-3 rounded-2xl bg-cinema-gold/15 text-cinema-gold mb-3 shadow-gold">
              <Sparkles size={28} className={isRolling ? 'animate-spin' : ''} />
            </div>

            <h3 className="font-serif font-bold text-xl text-cinema-white mb-1">
              Tonight's Mystery Selection
            </h3>
            <p className="text-xs text-cinema-subtle mb-4">
              Hand-picked by Personal Cinema from your library queue.
            </p>

            {isRolling || !surpriseMovie ? (
              <div className="py-12 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mb-3" />
                <span className="text-xs text-cinema-gold font-mono uppercase tracking-wider">
                  Scanning Vault...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-[2/3] w-36 mx-auto rounded-xl overflow-hidden shadow-2xl border border-cinema-gold/30">
                  {surpriseMovie.posterPath ? (
                    <img
                      src={tmdbService.getImageUrl(surpriseMovie.posterPath, 'w342')}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div>
                  <h4 className="font-bold text-cinema-white text-base">{surpriseMovie.title}</h4>
                  <p className="text-xs text-cinema-subtle">
                    {surpriseMovie.releaseDate?.substring(0, 4)} {surpriseMovie.runtime ? `· ${surpriseMovie.runtime}m` : ''}
                  </p>
                </div>

                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={handleSurpriseMe}
                    className="cinema-button-secondary px-4 py-2 text-xs"
                  >
                    Roll Again
                  </button>
                  <button
                    onClick={() => {
                      setIsSurpriseOpen(false);
                      openMovieDetail(surpriseMovie.id);
                    }}
                    className="cinema-button-primary px-5 py-2 text-xs font-semibold"
                  >
                    Watch This
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsSurpriseOpen(false)}
              className="mt-4 text-xs text-cinema-subtle hover:text-cinema-white underline block mx-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
