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
import { SEED_MOVIES } from '../data/seedCatalog';
import { atmosphereService } from '../services/atmosphereService';
import {
  Film,
  ChevronRight,
  TrendingUp,
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
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'trending').slice(0, 15)
  );
  const [popularMovies, setPopularMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'recent_popular').slice(0, 15)
  );
  const [tamilMovies, setTamilMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.originalLanguage === 'ta').slice(0, 15)
  );
  const [hollywoodMovies, setHollywoodMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.originalLanguage === 'en').slice(0, 15)
  );
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>(() =>
    [...SEED_MOVIES].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)).slice(0, 15)
  );

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

        // Render local state immediately
        if (isMounted) {
          setHeroMovie(initialHero);
          setContinueWatching(watchingList);
          setWatchlist(watchListItems);
          setRecentlyWatched(watchedListItems);
          setCollections(allCollections);
          setActiveJourney(foundJourney);

          if (initialHero?.movie) {
            setAmbientColor(atmosphereService.getArtworkAtmosphere(initialHero.movie.backdropPath || initialHero.movie.posterPath));
          }
        }

        // Fetch rich discovery feeds in background
        Promise.allSettled([
          tmdbService.getTrending('week'),
          tmdbService.getPopular(1),
          tmdbService.discover({ withOriginalLanguage: 'ta', sortBy: 'popularity.desc' }),
          tmdbService.discover({ withOriginCountry: 'US', sortBy: 'popularity.desc' }),
          tmdbService.discover({ sortBy: 'vote_average.desc', voteCountGte: 1000 }),
        ]).then(([trendingRes, popularRes, tamilRes, hollywoodRes, topRatedRes]) => {
          if (!isMounted) return;
          if (trendingRes.status === 'fulfilled' && trendingRes.value.length > 0) {
            setTrendingMovies(trendingRes.value);
            if (!chosenHero) {
              setHeroMovie({ movie: trendingRes.value[0] });
              setAmbientColor(atmosphereService.getArtworkAtmosphere(trendingRes.value[0].backdropPath || trendingRes.value[0].posterPath));
            }
          }
          if (popularRes.status === 'fulfilled' && popularRes.value.length > 0) {
            setPopularMovies(popularRes.value);
          }
          if (tamilRes.status === 'fulfilled' && tamilRes.value.length > 0) {
            setTamilMovies(tamilRes.value);
          }
          if (hollywoodRes.status === 'fulfilled' && hollywoodRes.value.length > 0) {
            setHollywoodMovies(hollywoodRes.value);
          }
          if (topRatedRes.status === 'fulfilled' && topRatedRes.value.length > 0) {
            setTopRatedMovies(topRatedRes.value);
          }
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

  return (
    <div className="pb-6 space-y-4 sm:space-y-6 select-none">
      {/* Compact Top Bar */}
      <div className="flex items-center justify-between pt-1 pb-1 border-b border-white/[0.06] animate-cinema-fade">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#E0AD52] to-[#D19830] flex items-center justify-center text-[#09090B] font-black text-xs shadow-[0_2px_10px_rgba(224,173,82,0.35)]">
            <Film size={13} strokeWidth={2.5} />
          </div>
          <span className="font-serif font-black text-sm tracking-[0.22em] text-[#F5F3EB]">
            MYCINEMA
          </span>
        </div>

        <button
          onClick={() => setActiveTab('discover')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-[#9E9DA5] hover:text-[#F5F3EB] transition-colors border border-white/[0.08] cursor-pointer"
          title="Search Movies"
        >
          <span>Search & Discover</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Compact Cinema Hero */}
      <CinemaHero
        movieWithData={heroMovie}
        onOpenDetails={(id) => openMovieDetail(id)}
      />

      {/* Compact New User Hint (Non-intrusive, no giant box) */}
      {watchlist.length === 0 && recentlyWatched.length === 0 && continueWatching.length === 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-[#131319] border border-white/[0.08] text-xs text-[#9E9DA5] flex items-center justify-between gap-3">
          <span>Tap any film below to track in your personal cinema vault.</span>
          <button
            onClick={() => setActiveTab('discover')}
            className="text-[#E0AD52] font-semibold hover:underline flex-shrink-0 cursor-pointer bg-transparent border-none p-0 text-xs"
          >
            Explore ›
          </button>
        </div>
      )}

      {/* Rail: Currently Watching (Only when items exist) */}
      {continueWatching.length > 0 && (
        <MoviePosterRail
          title="Currently Watching"
          subtitle="Films in active screening"
          items={continueWatching}
          onMovieClick={(m) => openMovieDetail(m.id)}
        />
      )}

      {/* Continue Your Journey: Active Collection Feature */}
      {activeJourney && (
        <section className="bg-gradient-to-r from-[#131319] to-[#0F0F14] border border-[#E0AD52]/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.7)] animate-cinema-rise">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-2.5 sm:mb-3">
            <div>
              <div className="flex items-center gap-1.5 text-[#E0AD52] text-[10px] sm:text-[11px] font-bold tracking-[0.16em] uppercase">
                <TrendingUp size={13} />
                <span>CONTINUE YOUR JOURNEY</span>
              </div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-[#F5F3EB] mt-0.5 break-words">
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

          <div className="space-y-1 mb-3">
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

          <div className="flex items-center gap-3 bg-[#09090B]/70 border border-white/[0.08] rounded-xl p-2.5 sm:p-3">
            <div className="w-12 sm:w-14 aspect-[2/3] rounded-lg overflow-hidden bg-[#131319] flex-shrink-0 shadow-lg border border-[#E0AD52]/20">
              {activeJourney.nextMovie.movie.posterPath ? (
                <img
                  src={tmdbService.getImageUrl(activeJourney.nextMovie.movie.posterPath, 'w185')}
                  alt={activeJourney.nextMovie.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#63626B]">
                  No Art
                </div>
              )}
            </div>

            <div className="flex-grow min-w-0 pr-2">
              <div className="text-[9px] text-[#E0AD52] font-black uppercase tracking-widest">
                NEXT IN COLLECTION
              </div>
              <h3
                className="font-serif font-bold text-xs sm:text-sm text-[#F5F3EB] line-clamp-2 break-words mt-0.5"
                title={activeJourney.nextMovie.movie.title}
              >
                {activeJourney.nextMovie.movie.title}
              </h3>
              <p className="text-[11px] text-[#9E9DA5] mt-0.5">
                {activeJourney.nextMovie.movie.releaseDate?.substring(0, 4)}{' '}
                {activeJourney.nextMovie.movie.runtime ? `· ${activeJourney.nextMovie.movie.runtime}m` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <WatchedButton
                movie={activeJourney.nextMovie.movie}
                userData={activeJourney.nextMovie.userData}
                style="icon"
              />
            </div>
          </div>
        </section>
      )}

      {/* Rail: On Your Watchlist (if present) */}
      {watchlist.length > 0 && (
        <MoviePosterRail
          title="On Your Watchlist"
          subtitle="Films queued up for your next screening"
          actionLabel="View All"
          onAction={() => setActiveTab('watchlist')}
          items={watchlist}
          onMovieClick={(m) => openMovieDetail(m.id)}
        />
      )}

      {/* Rail: Trending Now */}
      <MoviePosterRail
        title="Trending Now"
        subtitle="Most popular films worldwide right now"
        actionLabel="Explore"
        onAction={() => setActiveTab('discover')}
        items={trendingMovies.map((m) => ({ movie: m }))}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Rail: Popular Films */}
      <MoviePosterRail
        title="Popular Films"
        subtitle="Audience favorites with strong engagement"
        items={popularMovies.map((m) => ({ movie: m }))}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Rail: Tamil Cinema Spotlight */}
      {tamilMovies.length > 0 && (
        <MoviePosterRail
          title="Tamil Cinema"
          subtitle="Kollywood blockbusters, classics & thrillers"
          badge="Kollywood"
          items={tamilMovies.map((m) => ({ movie: m }))}
          onMovieClick={(m) => openMovieDetail(m.id)}
        />
      )}

      {/* Rail: Hollywood Hits */}
      {hollywoodMovies.length > 0 && (
        <MoviePosterRail
          title="Hollywood Hits"
          subtitle="Top American cinematic releases"
          badge="Hollywood"
          items={hollywoodMovies.map((m) => ({ movie: m }))}
          onMovieClick={(m) => openMovieDetail(m.id)}
        />
      )}

      {/* Rail: Critically Acclaimed */}
      <MoviePosterRail
        title="Critically Acclaimed"
        subtitle="Highest-rated masterpieces"
        items={topRatedMovies.map((m) => ({ movie: m }))}
        onMovieClick={(m) => openMovieDetail(m.id)}
      />

      {/* Curated Collections Rail */}
      {collections.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-section-title text-[#F5F3EB]">Curated Collections</h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                Thematic universes and marathons
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
      {recentlyWatched.length > 0 && (
        <MoviePosterRail
          title="Recently Watched"
          subtitle="Your logged screening history"
          actionLabel="View Archive"
          onAction={() => setActiveTab('watched')}
          items={recentlyWatched}
          onMovieClick={(m) => openMovieDetail(m.id)}
        />
      )}
    </div>
  );
};
