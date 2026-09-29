import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { useCinemaShell } from '../components/cinema/CinemaShell';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { tmdbService } from '../services/tmdbService';
import { MovieWithUserData, Movie } from '../types/movie';
import { Collection, CollectionProgress } from '../types/collection';
import { CinemaHero } from '../components/cinema/CinemaHero';
import { MoviePosterRail } from '../components/movie/MoviePosterRail';
import { CollectionCard } from '../components/collection/CollectionCard';
import { WatchedButton } from '../components/movie/WatchedButton';
import { CinemaModeModal } from '../components/cinema/CinemaModeModal';
import {
  Sparkles,
  Film,
  Clock,
  Flame,
  ChevronRight,
  TrendingUp,
  Play,
} from 'lucide-react';

export const Home: React.FC = () => {
  const {
    openMovieDetail,
    openCollectionDetail,
    setActiveTab,
    dataVersion,
  } = useCinema();

  const { setAmbientColor } = useCinemaShell();

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

          // Dynamic Ambient Atmosphere (Layer 1)
          if (chosenHero?.movie.backdropPath) {
            setAmbientColor('rgba(237, 194, 87, 0.12)');
          }
        }
      } catch (err) {
        console.error('Failed to load home data:', err);
      }
    }

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, [dataVersion, setAmbientColor]);

  const handleSurpriseMe = async () => {
    setIsSurpriseOpen(true);
    setIsRolling(true);

    const candidates = watchlist.length > 0 ? watchlist : await UserMovieRepository.getAllWithMovies();
    if (candidates.length > 0) {
      const randomIdx = Math.floor(Math.random() * candidates.length);
      setTimeout(() => {
        setSurpriseMovie(candidates[randomIdx].movie);
        setIsRolling(false);
      }, 650);
    } else {
      const trending = await tmdbService.getTrending('week');
      const randomIdx = Math.floor(Math.random() * trending.length);
      setTimeout(() => {
        setSurpriseMovie(trending[randomIdx]);
        setIsRolling(false);
      }, 650);
    }
  };

  return (
    <div className="pb-24 space-y-12 select-none">
      
      {/* LAYER 2 & 3 & 4: Cinematic Hero Stage */}
      <CinemaHero
        movieWithData={heroMovie}
        onWatchNow={() => setIsCinemaModeOpen(true)}
        onOpenDetails={(id) => openMovieDetail(id)}
        onSurpriseMe={handleSurpriseMe}
      />

      {/* Continue Your Journey: Active Collection Feature (Section 86 & 87) */}
      {activeJourney && (
        <section className="bg-gradient-to-r from-[#171924] to-[#10121A] border border-[#EDC257]/30 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.7)] animate-cinema-rise">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-[#EDC257] text-[11px] font-bold tracking-[0.16em] uppercase">
                <TrendingUp size={14} />
                <span>CONTINUE YOUR JOURNEY</span>
              </div>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#F5F2F0] mt-1">
                {activeJourney.collection.name}
              </h2>
            </div>

            <button
              onClick={() => openCollectionDetail(activeJourney.collection.id)}
              className="text-xs text-[#EDC257] hover:underline flex items-center gap-1 font-bold tracking-wide"
            >
              <span>View Full Saga</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Thin Cinematic Progress Bar */}
          <div className="space-y-1.5 mb-6">
            <div className="flex justify-between text-xs text-[#9E9DA5]">
              <span>
                {activeJourney.progress.watched} of {activeJourney.progress.total} watched
              </span>
              <span className="font-bold text-[#EDC257]">{activeJourney.progress.percent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#09090D] overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#EDC257] to-[#D99C33] transition-all duration-700 ease-out shadow-[0_0_10px_rgba(237,194,87,0.3)]"
                style={{ width: `${activeJourney.progress.percent}%` }}
              />
            </div>
          </div>

          {/* Next Up in Saga Movie Card */}
          <div className="flex items-center gap-4 bg-[#09090D]/60 border border-white/[0.08] rounded-2xl p-3.5 sm:p-5">
            <div className="w-16 sm:w-20 aspect-[2/3] rounded-xl overflow-hidden bg-[#171924] flex-shrink-0 shadow-lg border border-[#EDC257]/20">
              {activeJourney.nextMovie.movie.posterPath ? (
                <img
                  src={tmdbService.getImageUrl(activeJourney.nextMovie.movie.posterPath, 'w185')}
                  alt={activeJourney.nextMovie.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#5C5B64]">
                  No Poster
                </div>
              )}
            </div>

            <div className="flex-grow min-w-0">
              <div className="text-[10px] text-[#EDC257] font-black uppercase tracking-widest">
                NEXT UP IN SAGA
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-[#F5F2F0] truncate mt-0.5">
                {activeJourney.nextMovie.movie.title}
              </h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                {activeJourney.nextMovie.movie.releaseDate?.substring(0, 4)}{' '}
                {activeJourney.nextMovie.movie.runtime ? `· ${activeJourney.nextMovie.movie.runtime}m` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                onClick={() => openMovieDetail(activeJourney.nextMovie.movie.id)}
                className="cinema-button-primary px-4 py-2.5 text-xs font-bold hidden sm:flex items-center gap-1.5 shadow-[0_4px_16px_rgba(237,194,87,0.3)]"
              >
                <Play size={13} className="fill-[#09090D]" />
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
      <div className="grid grid-cols-3 gap-3 bg-[#171924]/60 border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-[#EDC257]/10 border border-[#EDC257]/20 flex items-center justify-center text-[#EDC257]">
            <Film size={18} />
          </div>
          <div>
            <div className="text-[11px] text-[#9E9DA5]">Watched</div>
            <div className="font-bold text-[#F5F2F0] text-sm sm:text-base">
              {stats.totalWatched} {stats.totalWatched === 1 ? 'Film' : 'Films'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 border-x border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-[#EDC257]/10 border border-[#EDC257]/20 flex items-center justify-center text-[#EDC257]">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-[11px] text-[#9E9DA5]">Screen Time</div>
            <div className="font-bold text-[#F5F2F0] text-sm sm:text-base">
              {stats.totalHours} hrs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-[#EDC257]/10 border border-[#EDC257]/20 flex items-center justify-center text-[#EDC257]">
            <Flame size={18} />
          </div>
          <div>
            <div className="text-[11px] text-[#9E9DA5]">Curated Sagas</div>
            <div className="font-bold text-[#F5F2F0] text-sm sm:text-base">
              {collections.length}
            </div>
          </div>
        </div>
      </div>

      {/* Rail: Currently Watching (Status = watching) */}
      <MoviePosterRail
        title="Currently Watching"
        subtitle="Active screenings in your cinema"
        actionLabel="View All"
        onAction={() => setActiveTab('library')}
        items={continueWatching}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Rail: On Your Watchlist */}
      <MoviePosterRail
        title="On Your Watchlist"
        subtitle="Films queued up for your next screening"
        actionLabel="View Library"
        onAction={() => setActiveTab('library')}
        items={watchlist}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Curated Sagas / Collections Rail */}
      {collections.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-section-title text-[#F5F2F0]">Curated Collections</h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                Thematic universes and cinematic marathons
              </p>
            </div>
            <button
              onClick={() => setActiveTab('collections')}
              className="cinema-button-ghost text-xs font-semibold flex items-center gap-1 text-[#EDC257] hover:text-[#EDC257] p-0"
            >
              <span>All Collections</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {collections.map((col) => (
              <div key={col.id} className="w-64 sm:w-72 flex-shrink-0">
                <CollectionCard
                  collection={col}
                  onClick={() => openCollectionDetail(col.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rail: Recently Watched */}
      <MoviePosterRail
        title="Recently Watched"
        subtitle="Your logged screening history"
        actionLabel="View Vault"
        onAction={() => setActiveTab('library')}
        items={recentlyWatched}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Rail: Recommended For You */}
      <MoviePosterRail
        title="Recommended For You"
        subtitle="Trending films worldwide to expand your vault"
        actionLabel="Discover More"
        onAction={() => setActiveTab('discover')}
        items={recommendations.map((m) => ({ movie: m }))}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Hero Cinema Mode Atmospheric Screening Modal */}
      {isCinemaModeOpen && heroMovie && (
        <CinemaModeModal
          movie={heroMovie.movie}
          userData={heroMovie.userData}
          onClose={() => setIsCinemaModeOpen(false)}
        />
      )}

      {/* Surprise Me Modal */}
      {isSurpriseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050508]/85 backdrop-blur-md animate-cinema-fade">
          <div className="relative w-full max-w-sm bg-[#171924] border border-[#EDC257]/40 rounded-2xl shadow-2xl p-6 text-center animate-cinema-scale">
            <div className="inline-flex p-3 rounded-2xl bg-[#EDC257]/15 text-[#EDC257] mb-3 shadow-[0_2px_12px_rgba(237,194,87,0.3)]">
              <Sparkles size={28} className={isRolling ? 'animate-spin' : ''} />
            </div>

            <h3 className="font-serif font-bold text-xl text-[#F5F2F0] mb-1">
              Tonight's Mystery Selection
            </h3>
            <p className="text-xs text-[#9E9DA5] mb-4">
              Hand-picked by Personal Cinema from your library queue.
            </p>

            {isRolling || !surpriseMovie ? (
              <div className="py-12 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-[#222534] border-t-[#EDC257] animate-spin mb-3" />
                <span className="text-xs text-[#EDC257] font-mono uppercase tracking-wider">
                  Scanning Vault...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-[2/3] w-36 mx-auto rounded-xl overflow-hidden shadow-2xl border border-[#EDC257]/30">
                  {surpriseMovie.posterPath ? (
                    <img
                      src={tmdbService.getImageUrl(surpriseMovie.posterPath, 'w342')}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div>
                  <h4 className="font-bold text-[#F5F2F0] text-base">{surpriseMovie.title}</h4>
                  <p className="text-xs text-[#9E9DA5]">
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
              className="mt-4 text-xs text-[#9E9DA5] hover:text-[#F5F2F0] underline block mx-auto cursor-pointer bg-transparent border-none"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
