import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { tmdbService } from '../services/tmdbService';
import { MovieWithUserData, Movie } from '../types/movie';
import { Collection, CollectionProgress } from '../types/collection';
import { PosterCard } from '../components/movie/PosterCard';
import { CollectionCard } from '../components/collection/CollectionCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { EmptyState } from '../components/common/EmptyState';
import { WatchedButton } from '../components/movie/WatchedButton';
import { CinemaModeModal } from '../components/cinema/CinemaModeModal';
import {
  Play,
  Sparkles,
  Film,
  Clock,
  Flame,
  Star,
  Search,
  User as UserIcon,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

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
  const [activeJourney, setActiveJourney] = useState<{
    collection: Collection;
    progress: CollectionProgress;
    nextMovie: MovieWithUserData;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [stats, setStats] = useState<{ totalWatched: number; totalHours: number; streak: number }>({
    totalWatched: 0,
    totalHours: 0,
    streak: 0,
  });

  // Cinema Mode Modal state
  const [isCinemaModeOpen, setIsCinemaModeOpen] = useState(false);

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

        // Find active collection journey (collection with both watched and unwatched films)
        let foundJourney: { collection: Collection; progress: CollectionProgress; nextMovie: MovieWithUserData } | null = null;
        for (const col of allCollections) {
          const colFull = await CollectionRepository.getWithMovies(col.id);
          if (colFull && colFull.movies.length > 0) {
            const unwatched = colFull.movies.filter((m) => m.userData?.status !== 'watched');
            if (unwatched.length > 0 && colFull.progress.watched > 0) {
              foundJourney = {
                collection: colFull.collection,
                progress: colFull.progress,
                nextMovie: unwatched[0],
              };
              break;
            }
          }
        }

        // If no partially watched collection, look for any collection with movies
        if (!foundJourney && allCollections.length > 0) {
          for (const col of allCollections) {
            const colFull = await CollectionRepository.getWithMovies(col.id);
            if (colFull && colFull.movies.length > 0) {
              const unwatched = colFull.movies.filter((m) => m.userData?.status !== 'watched');
              if (unwatched.length > 0) {
                foundJourney = {
                  collection: colFull.collection,
                  progress: colFull.progress,
                  nextMovie: unwatched[0],
                };
                break;
              }
            }
          }
        }

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

        // Fetch recommendations / trending for recommendations rail
        const trendingList = await tmdbService.getTrending('week');

        if (isMounted) {
          setHeroMovie(chosenHero);
          setContinueWatching(watchingList);
          setWatchlist(watchListItems);
          setRecentlyWatched(watchedListItems);
          setCollections(allCollections);
          setActiveJourney(foundJourney);
          setRecommendations(trendingList.slice(0, 10));
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
      const randomIdx = Math.floor(Math.random() * candidates.length);
      setTimeout(() => {
        setSurpriseMovie(candidates[randomIdx].movie);
        setIsRolling(false);
      }, 700);
    } else {
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
    <div className="pb-24 space-y-10">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cinema-gold to-cinema-amber flex items-center justify-center text-cinema-black font-extrabold text-sm shadow-gold">
            ▶
          </div>
          <div>
            <div className="font-serif font-extrabold text-base tracking-widest text-cinema-white leading-tight">
              PERSONAL CINEMA
            </div>
            <div className="text-[10px] tracking-widest text-cinema-gold font-bold">
              YOUR PRIVATE THEATER
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('discover')}
            className="p-2.5 rounded-full bg-cinema-surface/70 hover:bg-cinema-surface border border-white/5 text-cinema-silver hover:text-cinema-white transition-colors"
            title="Search Movies"
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className="p-2.5 rounded-full bg-cinema-surface/70 hover:bg-cinema-surface border border-white/5 text-cinema-silver hover:text-cinema-white transition-colors"
            title="Profile & Vault"
          >
            <UserIcon size={16} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative -mx-4 -mt-2 sm:-mx-8 h-[65vh] min-h-[440px] max-h-[620px] bg-cinema-black rounded-3xl overflow-hidden flex items-end shadow-2xl border border-white/5">
        {/* Backdrop Image */}
        {heroBackdrop && (
          <img
            src={heroBackdrop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.08] transform scale-105 transition-transform duration-1000"
          />
        )}

        {/* Ambient Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-cinema-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-cinema-black/90 via-cinema-black/20 to-transparent" />

        {/* Hero Content */}
        <div className="relative z-10 w-full px-6 sm:px-10 pb-8 sm:pb-10 max-w-4xl">
          {/* Greeting Tag */}
          <div className="flex items-center gap-2 text-cinema-gold text-xs font-semibold tracking-widest uppercase mb-2 animate-fade-in">
            <Sparkles size={14} className="text-cinema-gold" />
            <span>
              GOOD {timeOfDay}, {userName}. WHAT ARE WE WATCHING?
            </span>
          </div>

          {heroMovie ? (
            <div>
              <h1 className="font-serif font-extrabold text-3xl sm:text-5xl md:text-6xl text-cinema-white tracking-tight drop-shadow-2xl mb-2 sm:mb-3">
                {heroMovie.movie.title}
              </h1>

              {/* Metadata strip */}
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-cinema-silver mb-3 drop-shadow">
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
                  onClick={() => setIsCinemaModeOpen(true)}
                  className="cinema-button-primary px-5 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-gold"
                >
                  <Play size={16} className="fill-cinema-black" />
                  <span>Watch Now</span>
                </button>

                <WatchedButton
                  movie={heroMovie.movie}
                  userData={heroMovie.userData}
                  style="pill"
                />

                <button
                  onClick={() => openMovieDetail(heroMovie.movie.id)}
                  className="cinema-button-secondary px-4 py-2.5 sm:py-3 flex items-center gap-2 text-xs sm:text-sm backdrop-blur-md"
                >
                  <span>Details</span>
                </button>

                <button
                  onClick={handleSurpriseMe}
                  className="p-2.5 sm:p-3 rounded-xl bg-cinema-surface/70 hover:bg-cinema-surface border border-white/5 text-cinema-silver hover:text-cinema-white transition-colors"
                  title="Surprise Me"
                >
                  <Sparkles size={16} className="text-cinema-gold" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-cinema-silver">
              <h2 className="font-serif text-3xl font-bold text-cinema-white mb-2">
                Welcome to Personal Cinema
              </h2>
              <p className="text-sm max-w-lg mb-4">
                Your private cinematic haven for tracking and exploring movies.
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

      {/* Continue Your Journey: Active Collection Feature */}
      {activeJourney && (
        <section className="bg-gradient-to-r from-cinema-surface to-cinema-deep-navy border border-cinema-gold/30 rounded-3xl p-5 sm:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-cinema-gold text-xs font-semibold tracking-widest uppercase">
                <TrendingUp size={14} />
                <span>CONTINUE YOUR JOURNEY</span>
              </div>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-cinema-white mt-1">
                {activeJourney.collection.name}
              </h2>
            </div>

            <button
              onClick={() => openCollectionDetail(activeJourney.collection.id)}
              className="text-xs text-cinema-gold hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View Full Journey</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 mb-5">
            <div className="flex justify-between text-xs text-cinema-subtle">
              <span>
                {activeJourney.progress.watched} of {activeJourney.progress.total} watched
              </span>
              <span className="font-bold text-cinema-gold">{activeJourney.progress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-cinema-charcoal overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cinema-gold to-cinema-amber transition-all duration-500 shadow-gold"
                style={{ width: `${activeJourney.progress.percent}%` }}
              />
            </div>
          </div>

          {/* Next Up Movie Card */}
          <div className="flex items-center gap-4 bg-cinema-black/50 border border-white/5 rounded-2xl p-3 sm:p-4">
            <div className="w-16 sm:w-20 aspect-[2/3] rounded-xl overflow-hidden bg-cinema-charcoal flex-shrink-0 shadow-lg border border-cinema-gold/20">
              {activeJourney.nextMovie.movie.posterPath ? (
                <img
                  src={tmdbService.getImageUrl(activeJourney.nextMovie.movie.posterPath, 'w185')}
                  alt={activeJourney.nextMovie.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-cinema-subtle">
                  No Poster
                </div>
              )}
            </div>

            <div className="flex-grow min-w-0">
              <div className="text-[11px] text-cinema-gold font-bold uppercase tracking-wider">
                NEXT UP IN SAGA
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-cinema-white truncate mt-0.5">
                {activeJourney.nextMovie.movie.title}
              </h3>
              <p className="text-xs text-cinema-subtle mt-0.5">
                {activeJourney.nextMovie.movie.releaseDate?.substring(0, 4)}{' '}
                {activeJourney.nextMovie.movie.runtime ? `· ${activeJourney.nextMovie.movie.runtime}m` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openMovieDetail(activeJourney.nextMovie.movie.id)}
                className="cinema-button-primary px-4 py-2 text-xs font-semibold shadow-gold hidden sm:flex items-center gap-1.5"
              >
                <Play size={13} className="fill-cinema-black" />
                <span>Screen Now</span>
              </button>
              <WatchedButton
                movie={activeJourney.nextMovie.movie}
                userData={activeJourney.nextMovie.userData}
                style="icon"
              />
            </div>
          </div>
        </section>
      )}

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

      {/* Rail: Currently Watching (Status = watching) */}
      {continueWatching.length > 0 && (
        <section>
          <SectionHeader
            title="Currently Watching"
            subtitle="Films in active screening"
            actionLabel="View All"
            onAction={() => setActiveTab('library')}
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {continueWatching.map((item) => (
              <div key={item.movie.id} className="w-36 sm:w-44 flex-shrink-0">
                <PosterCard
                  movie={item.movie}
                  userData={item.userData}
                  onClick={() => openMovieDetail(item.movie.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rail: On Your Watchlist */}
      <section>
        <SectionHeader
          title="On Your Watchlist"
          subtitle="Films queued up for your next screening"
          actionLabel="View Library"
          onAction={() => setActiveTab('library')}
        />
        {watchlist.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {watchlist.map((item) => (
              <div key={item.movie.id} className="w-36 sm:w-44 flex-shrink-0">
                <PosterCard
                  movie={item.movie}
                  userData={item.userData}
                  onClick={() => openMovieDetail(item.movie.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your Watchlist is Empty"
            description="Explore trending films and add what catches your eye."
            actionText="Discover Movies"
            onAction={() => setActiveTab('discover')}
          />
        )}
      </section>

      {/* Rail: Recently Watched */}
      {recentlyWatched.length > 0 && (
        <section>
          <SectionHeader
            title="Recently Watched"
            subtitle="Your logged screening history"
            actionLabel="View Vault"
            onAction={() => setActiveTab('library')}
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {recentlyWatched.map((item) => (
              <div key={item.movie.id} className="w-36 sm:w-44 flex-shrink-0">
                <PosterCard
                  movie={item.movie}
                  userData={item.userData}
                  onClick={() => openMovieDetail(item.movie.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rail: Curated Collections */}
      <section>
        <SectionHeader
          title="Curated Collections"
          subtitle="Sagas, directors, and cinematic universes"
          actionLabel="All Collections"
          onAction={() => setActiveTab('collections')}
        />
        {collections.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {collections.map((col) => (
              <div key={col.id} className="w-64 sm:w-72 flex-shrink-0">
                <CollectionCard
                  collection={col}
                  onClick={() => openCollectionDetail(col.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Create Custom Collections"
            description="Organize your films by director, franchise, or mood."
            actionText="Explore Collections"
            onAction={() => setActiveTab('collections')}
          />
        )}
      </section>

      {/* Rail: Recommended For You */}
      {recommendations.length > 0 && (
        <section>
          <SectionHeader
            title="Recommended For You"
            subtitle="Films trending worldwide to expand your vault"
            actionLabel="Discover More"
            onAction={() => setActiveTab('discover')}
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {recommendations.map((rec) => (
              <div key={rec.id} className="w-36 sm:w-44 flex-shrink-0">
                <PosterCard
                  movie={rec}
                  onClick={() => openMovieDetail(rec.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hero Cinema Mode Modal */}
      {isCinemaModeOpen && heroMovie && (
        <CinemaModeModal
          movie={heroMovie.movie}
          userData={heroMovie.userData}
          onClose={() => setIsCinemaModeOpen(false)}
        />
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
