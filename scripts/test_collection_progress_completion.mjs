import 'fake-indexeddb/auto';
import { getDB } from '../src/db/database.ts';
import { CollectionRepository } from '../src/db/repositories/collectionRepository.ts';
import { UserMovieRepository } from '../src/db/repositories/userMovieRepository.ts';
import { MovieRepository } from '../src/db/repositories/movieRepository.ts';

async function runProgressAndCompletionTest() {
  console.log('============================================================');
  console.log('COLLECTION PROGRESS & COMPLETION LIFECYCLE TEST');
  console.log('============================================================');

  // Setup 3 canonical movies
  const movies = [
    { id: 101, title: 'Batman Begins', releaseDate: '2005-06-15', voteAverage: 8.2 },
    { id: 102, title: 'The Dark Knight', releaseDate: '2008-07-18', voteAverage: 9.0 },
    { id: 103, title: 'The Dark Knight Rises', releaseDate: '2012-07-20', voteAverage: 8.4 },
  ];
  for (const m of movies) {
    await MovieRepository.save(m);
  }

  // Create Collection
  const col = await CollectionRepository.create({
    name: 'The Dark Knight Trilogy',
    description: 'Nolan Batman Trilogy',
    coverType: 'collage',
    sortMode: 'releaseDate',
  });
  console.log('Created Trilogy Collection:', col.id);

  // Add 3 movies
  await CollectionRepository.addMoviesToCollection(col.id, [101, 102, 103]);

  // Check 1: 0/3 watched
  let progress = await CollectionRepository.calculateProgress(col.id);
  console.log('Initial Progress:', progress);
  if (progress.total !== 3 || progress.watched !== 0 || progress.percent !== 0 || progress.isComplete !== false) {
    throw new Error('Initial progress assertion failed');
  }
  let refreshedCol = await CollectionRepository.getById(col.id);
  if (refreshedCol.completedAt !== null) throw new Error('completedAt should be null when not complete');
  console.log('[PASS] 0/3 watched: 0% complete, completedAt is null');

  // Check 2: Mark movie 101 watched
  await UserMovieRepository.save({
    movieId: 101,
    status: 'watched',
    watchedAt: new Date().toISOString(),
  });
  progress = await CollectionRepository.calculateProgress(col.id);
  console.log('Progress after watching 101:', progress);
  if (progress.watched !== 1 || progress.percent !== 33 || progress.isComplete !== false) {
    throw new Error('1/3 progress assertion failed');
  }
  console.log('[PASS] 1/3 watched: 33%, isComplete: false');

  // Check 3: Mark movie 102 watched
  await UserMovieRepository.save({
    movieId: 102,
    status: 'watched',
    watchedAt: new Date().toISOString(),
  });
  progress = await CollectionRepository.calculateProgress(col.id);
  console.log('Progress after watching 102:', progress);
  if (progress.watched !== 2 || progress.percent !== 67 || progress.isComplete !== false) {
    throw new Error('2/3 progress assertion failed');
  }
  console.log('[PASS] 2/3 watched: 67%, isComplete: false');

  // Check 4: Mark movie 103 watched -> Complete!
  await UserMovieRepository.save({
    movieId: 103,
    status: 'watched',
    watchedAt: new Date().toISOString(),
  });
  progress = await CollectionRepository.calculateProgress(col.id);
  console.log('Progress after watching 103 (All):', progress);
  if (progress.watched !== 3 || progress.percent !== 100 || progress.isComplete !== true) {
    throw new Error('3/3 complete progress assertion failed');
  }
  refreshedCol = await CollectionRepository.getById(col.id);
  if (!refreshedCol.completedAt) throw new Error('completedAt MUST be recorded when 100% complete');
  if (refreshedCol.finalMovieId !== 103) throw new Error(`finalMovieId must be 103, got ${refreshedCol.finalMovieId}`);
  console.log('[PASS] 3/3 watched: 100%, isComplete: true, completedAt persisted:', refreshedCol.completedAt);

  // Check 5: Unwatch movie 102 -> Completion must reset!
  await UserMovieRepository.save({
    movieId: 102,
    status: 'want_to_watch',
    watchedAt: null,
  });
  progress = await CollectionRepository.calculateProgress(col.id);
  console.log('Progress after unwatching 102:', progress);
  if (progress.watched !== 2 || progress.percent !== 67 || progress.isComplete !== false) {
    throw new Error('Unwatched progress assertion failed');
  }
  refreshedCol = await CollectionRepository.getById(col.id);
  if (refreshedCol.completedAt !== null) throw new Error('completedAt MUST be cleared to null when unwatching');
  if (refreshedCol.finalMovieId !== null) throw new Error('finalMovieId MUST be cleared to null when unwatching');
  console.log('[PASS] Unwatch correctly resets isComplete to false and clears completedAt to null');

  // Check 6: Check getWithMovies integration
  const withMovies = await CollectionRepository.getWithMovies(col.id);
  if (!withMovies || withMovies.movies.length !== 3 || withMovies.progress.watched !== 2) {
    throw new Error('getWithMovies assertion failed');
  }
  console.log('[PASS] getWithMovies accurately joins movies with canonical progress');

  console.log('\n============================================================');
  console.log('COLLECTION PROGRESS & COMPLETION TEST PASSED 100%');
  console.log('============================================================');
}

runProgressAndCompletionTest().catch((err) => {
  console.error('\n[FAIL] Test encountered error:', err);
  process.exit(1);
});
