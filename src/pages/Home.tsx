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
import { CinemaButton } from '../components/common/CinemaButton';
import { SEED_MOVIES } from '../data/seedCatalog';
import { atmosphereService } from '../services/atmosphereService';
import {
  Sparkles,
  Film,
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
    preferences,
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



        // Choose Hero: first watching movie, or first watchlist item, or first library item
        let chosenHero: MovieWithUserData | null = null;
        if (watchingList.length > 0) {
          chosenHero = watchingList[0];
        } else if (watchListItems.length > 0) {
          chosenHero = watchListItems[0];
        } else if (allLibrary.length > 0) {
          chosenHero = allLibrary[0];
        }

        // Fallback hero if user library is empty: use first seed movie immediately
        const initialHero = chosenHero || (SEED_MOVIES.length > 0 ? { movie: SEED_MOVIES[0] } : null);

        // Render local state immediately (Section 21: TMDB must NOT block local sections)
        if (isMounted) {
          setHeroMovie(initialHero);
          setContinueWatching(watchingList);
          setWatchlist(watchListItems);
          setRecentlyWatched(watchedListItems);
          setCollections(allCollections);
          setActiveJourney(foundJourney);
          setRecommendations(SEED_MOVIES.slice(1, 9));

          if (initialHero?.movie) {
            setAmbientColor(atmosphereService.getArtworkAtmosphere(initialHero.movie.backdropPath || initialHero.movie.posterPath));
          }
        }

        // Load TMDB-dependent recommendations independently in background (Non-blocking)
        tmdbService.getTrending('week').then((trendingList) => {
          if (!isMounted) return;
          if (trendingList.length > 0) {
            setRecommendations(trendingList.slice(0, 10));

            // If library was empty and using fallback landmark, upgrade to live weekly trending hero
            if (!chosenHero) {
              setHeroMovie({ movie: trendingList[0] });
              setAmbientColor(atmosphereService.getArtworkAtmosphere(trendingList[0].backdropPath || trendingList[0].posterPath));
            }
          }
        }).catch((err) => {
          console.warn('Home recommendations background fetch error:', err);
        });
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

    const unwatchedLibrary = (await UserMovieRepository.getAllWithMovies()).filter(
      (m) => m.userData?.status !== 'watched'
    );
    const candidates = watchlist.length > 0 ? watchlist : unwatchedLibrary;
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const displayName = preferences.displayName?.trim();

  return (
    <div className="pb-4 space-y-6 sm:space-y-8 select-none">
      {/* Brand & Personalized Header */}
      <div className="pt-1 pb-0.5 space-y-1 animate-cinema-fade">
        <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.24em] text-[#E0AD52]">
          MYCINEMA
        </div>
        <h1 className="font-serif font-black text-xl sm:text-2xl md:text-3xl text-[#F5F3EB] tracking-tight">
          Good {greeting}{displayName ? `, ${displayName}` : ''}.
        </h1>
        <p className="text-xs sm:text-sm text-[#9E9DA5]">
          What would you like to watch?
        </p>
      </div>

      {/* Featured Screening Stage */}
      <CinemaHero
        movieWithData={heroMovie}
        onWatchNow={() => setIsCinemaModeOpen(true)}
        onOpenDetails={(id) => openMovieDetail(id)}
        onSurpriseMe={handleSurpriseMe}
      />

      {/* Continue Your Journey: Active Collection Feature (Section 86 & 87) */}
      {activeJourney && (
        <section className="bg-gradient-to-r from-[#131319] to-[#0F0F14] border border-[#E0AD52]/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.7)] animate-cinema-rise">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-[#E0AD52] text-[10px] sm:text-[11px] font-bold tracking-[0.16em] uppercase">
                <TrendingUp size={13} />
                <span>CONTINUE YOUR JOURNEY</span>
              </div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-[#F5F3EB] mt-0.5 break-words">
                {activeJourney.collection.name}
              </h2>
            </div>

            <button
              onClick={() => openCollectionDetail(activeJourney.collection.id)}
              className="text-xs text-[#E0AD52] hover:underline flex items-center gap-1 font-bold tracking-wide min-h-[44px] cursor-pointer bg-transparent border-none"
            >
              <span>View Collection</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Thin Cinematic Progress Bar */}
          <div className="space-y-1 mb-4 sm:mb-5">
            <div className="flex justify-between text-xs text-[#9E9DA5]">
              <span>
                {activeJourney.progress.watched} of {activeJourney.progress.total} watched
              </span>
              <span className="font-bold text-[#E0AD52]">{activeJourney.progress.percent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#09090B] overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#E0AD52] to-[#D19830] transition-all duration-700 ease-out shadow-[0_0_10px_rgba(224,173,82,0.35)]"
                style={{ width: `${activeJourney.progress.percent}%` }}
              />
            </div>
          </div>

          {/* Next Up in Collection Movie Card with Strict Boundary Containment */}
          <div className="flex items-center gap-3 sm:gap-4 bg-[#09090B]/70 border border-white/[0.08] rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div className="w-14 sm:w-16 aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden bg-[#131319] flex-shrink-0 shadow-lg border border-[#E0AD52]/20">
              {activeJourney.nextMovie.movie.posterPath ? (
                <img
                  src={tmdbService.getImageUrl(activeJourney.nextMovie.movie.posterPath, 'w185')}
                  alt={activeJourney.nextMovie.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#63626B]">
                  No Poster
                </div>
              )}
            </div>

            <div className="flex-grow min-w-0 pr-2">
              <div className="text-[9px] sm:text-[10px] text-[#E0AD52] font-black uppercase tracking-widest">
                NEXT IN COLLECTION
              </div>
              <h3
                className="font-serif font-bold text-sm sm:text-base text-[#F5F3EB] line-clamp-2 break-words mt-0.5"
                title={activeJourney.nextMovie.movie.title}
              >
                {activeJourney.nextMovie.movie.title}
              </h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                {activeJourney.nextMovie.movie.releaseDate?.substring(0, 4)}{' '}
                {activeJourney.nextMovie.movie.runtime ? `· ${activeJourney.nextMovie.movie.runtime}m` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openMovieDetail(activeJourney.nextMovie.movie.id)}
                className="cinema-button-primary px-3.5 py-2 text-xs font-bold hidden sm:flex items-center gap-1.5 shadow-[0_4px_16px_rgba(224,173,82,0.3)] min-h-[44px]"
              >
                <Play size={13} className="fill-[#09090B]" />
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



      {/* Intentional Cinema Onboarding Card */}
      {watchlist.length === 0 && recentlyWatched.length === 0 && continueWatching.length === 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#131319] border border-white/[0.08] text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <div className="w-12 h-12 rounded-2xl bg-[#E0AD52]/15 text-[#E0AD52] mx-auto flex items-center justify-center border border-[#E0AD52]/20">
            <Film size={24} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="font-serif font-black text-lg sm:text-xl text-[#F5F3EB]">
              Your Cinema Is Waiting
            </h3>
            <p className="text-xs sm:text-sm text-[#9E9DA5] mt-1.5 leading-relaxed">
              Start building your personal movie catalog. Discover landmark world cinema or import your existing movie lists.
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <CinemaButton variant="primary" size="md" onClick={() => setActiveTab('discover')}>
              Discover Movies
            </CinemaButton>
            <CinemaButton variant="secondary" size="md" onClick={() => setActiveTab('profile')}>
              Import Movie List
            </CinemaButton>
          </div>
        </div>
      )}

      {/* Rail: Currently Watching (Status = watching) */}
      <MoviePosterRail
        title="Currently Watching"
        subtitle="Active screenings in your cinema"
        items={continueWatching}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Rail: On Your Watchlist */}
      <MoviePosterRail
        title="On Your Watchlist"
        subtitle="Films queued up for your next screening"
        items={watchlist}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Curated Collections Rail */}
      {collections.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-section-title text-[#F5F3EB]">Curated Collections</h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                Thematic universes and cinematic marathons
              </p>
            </div>
            <button
              onClick={() => setActiveTab('collections')}
              className="cinema-button-ghost text-xs font-semibold flex items-center gap-1 text-[#E0AD52] hover:text-[#D49B35] p-0 cursor-pointer"
            >
              <span>All Collections</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain no-scrollbar pb-2.5 pt-1 -mx-3.5 px-3.5 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
            {collections.map((col) => (
              <div key={col.id} className="w-56 sm:w-64 md:w-72 flex-shrink-0">
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
        onAction={() => setActiveTab('profile')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090B]/85 backdrop-blur-xl animate-cinema-fade">
          <div className="relative w-full max-w-sm bg-[#131319] border border-[#E0AD52]/40 rounded-3xl shadow-2xl p-6 text-center animate-cinema-scale">
            <div className="inline-flex p-3 rounded-2xl bg-[#E0AD52]/15 text-[#E0AD52] mb-3 shadow-[0_2px_12px_rgba(224,173,82,0.3)] border border-[#E0AD52]/20">
              <Sparkles size={28} className={isRolling ? 'animate-spin' : ''} />
            </div>

            <h3 className="font-serif font-black text-xl text-[#F5F3EB] mb-1">
              Tonight's Mystery Selection
            </h3>
            <p className="text-xs text-[#9E9DA5] mb-4">
              Hand-picked by MyCinema from your screening vault.
            </p>

            {isRolling || !surpriseMovie ? (
              <div className="py-12 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-[#E0AD52] animate-spin mb-3" />
                <span className="text-xs text-[#E0AD52] font-mono uppercase tracking-wider">
                  Scanning Vault...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-[2/3] w-36 mx-auto rounded-2xl overflow-hidden shadow-2xl border border-[#E0AD52]/30">
                  {surpriseMovie.posterPath ? (
                    <img
                      src={tmdbService.getImageUrl(surpriseMovie.posterPath, 'w342')}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div>
                  <h4 className="font-bold text-[#F5F3EB] text-base">{surpriseMovie.title}</h4>
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
              className="mt-4 text-xs text-[#9E9DA5] hover:text-[#F5F3EB] underline block mx-auto cursor-pointer bg-transparent border-none"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
