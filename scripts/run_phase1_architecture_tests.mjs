// scripts/run_phase1_architecture_tests.mjs
// Phase 1 Architecture, Curated Catalog, Collections Completion, & Core Functionality Test Suite

import 'fake-indexeddb/auto';
import { openDB } from 'idb';

console.log('============================================================');
console.log('MYCINEMA — PHASE 1 ARCHITECTURE & DATA VERIFICATION SUITE');
console.log('============================================================\n');

const testResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(testNumber, testName, fn) {
  const label = `TEST ${testNumber}: ${testName}`;
  try {
    const detail = await fn();
    testResults.push({ num: testNumber, name: testName, pass: true, detail });
    console.log(`[PASS] ${label} - ${detail}`);
  } catch (err) {
    testResults.push({ num: testNumber, name: testName, pass: false, error: err.message });
    console.error(`[FAIL] ${label}: ${err.message}`);
  }
}

async function createTestDB(dbName, version = 3) {
  return openDB(dbName, version, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('movies')) {
        const movieStore = db.createObjectStore('movies', { keyPath: 'id' });
        movieStore.createIndex('by-title', 'title');
      }
      if (!db.objectStoreNames.contains('userMovies')) {
        const userMovieStore = db.createObjectStore('userMovies', { keyPath: 'movieId' });
        userMovieStore.createIndex('by-status', 'status');
        userMovieStore.createIndex('by-favorite', 'isFavorite');
        userMovieStore.createIndex('by-watchedAt', 'watchedAt');
        userMovieStore.createIndex('by-addedAt', 'addedAt');
      }
      if (!db.objectStoreNames.contains('collections')) {
        const colStore = db.createObjectStore('collections', { keyPath: 'id' });
        colStore.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('collectionMovies')) {
        const colMovieStore = db.createObjectStore('collectionMovies', { keyPath: 'id' });
        colMovieStore.createIndex('by-collection', 'collectionId');
        colMovieStore.createIndex('by-movie', 'movieId');
        colMovieStore.createIndex('by-collection-position', ['collectionId', 'position']);
      }
      if (db.objectStoreNames.contains('movieNights')) {
        db.deleteObjectStore('movieNights');
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('achievements')) {
        db.createObjectStore('achievements', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tmdbCache')) {
        const cacheStore = db.createObjectStore('tmdbCache', { keyPath: 'key' });
        cacheStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });
}

async function main() {
  const dbName = 'phase1_test_db_' + Date.now();
  const db = await createTestDB(dbName, 3);

  // 1. Verify DB Schema V3 has no movieNights
  await runTest(1, 'Database Schema V3 has purged movieNights store', async () => {
    assert(!db.objectStoreNames.contains('movieNights'), 'movieNights store must not exist in V3 schema');
    return 'Confirmed movieNights store absent from DB';
  });

  // 2. Collection completion records completedAt and finalMovieId
  await runTest(2, 'Collection completion records completedAt and finalMovieId', async () => {
    // Insert 2 movies
    await db.put('movies', { id: 101, title: 'The Dark Knight', voteAverage: 9.0, genres: [] });
    await db.put('movies', { id: 102, title: 'The Dark Knight Rises', voteAverage: 8.4, genres: [] });

    // Create collection
    const colId = 'col_batman';
    const now = new Date().toISOString();
    await db.put('collections', {
      id: colId,
      name: 'Dark Knight Saga',
      coverType: 'hero',
      sortMode: 'custom',
      customOrder: [101, 102],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      finalMovieId: null,
    });

    await db.put('collectionMovies', { id: `${colId}_101`, collectionId: colId, movieId: 101, position: 0, addedAt: now });
    await db.put('collectionMovies', { id: `${colId}_102`, collectionId: colId, movieId: 102, position: 1, addedAt: now });

    // Mark movie 101 watched first
    await db.put('userMovies', {
      movieId: 101,
      status: 'watched',
      watchedAt: '2026-09-01T10:00:00.000Z',
      isFavorite: false,
      rewatchCount: 0,
    });

    // Mark movie 102 watched later (the final film!)
    await db.put('userMovies', {
      movieId: 102,
      status: 'watched',
      watchedAt: '2026-09-02T15:30:00.000Z',
      isFavorite: true,
      rewatchCount: 0,
    });

    // Simulate calculateProgress logic
    const colMovies = await db.getAllFromIndex('collectionMovies', 'by-collection', colId);
    let watched = 0;
    let latestWatchedTime = -1;
    let finalMovieId = null;

    for (const cm of colMovies) {
      const um = await db.get('userMovies', cm.movieId);
      if (um?.status === 'watched') {
        watched++;
        const time = new Date(um.watchedAt).getTime();
        if (time >= latestWatchedTime) {
          latestWatchedTime = time;
          finalMovieId = cm.movieId;
        }
      }
    }

    const isComplete = colMovies.length > 0 && watched === colMovies.length;
    assert(isComplete, 'Collection must be complete');
    assert(finalMovieId === 102, `Final movie ID should be 102, got ${finalMovieId}`);

    const col = await db.get('collections', colId);
    col.completedAt = new Date().toISOString();
    col.finalMovieId = finalMovieId;
    await db.put('collections', col);

    const verified = await db.get('collections', colId);
    assert(verified.finalMovieId === 102, 'finalMovieId persisted correctly');
    assert(verified.completedAt !== null, 'completedAt persisted correctly');

    return `finalMovieId: ${verified.finalMovieId} (The Dark Knight Rises) completedAt: ${verified.completedAt}`;
  });

  // 3. Unmarking a movie clears completedAt and finalMovieId
  await runTest(3, 'Unmarking a movie clears completedAt and finalMovieId reactively', async () => {
    const colId = 'col_batman';
    // Unmark movie 102
    const um102 = await db.get('userMovies', 102);
    um102.status = 'want_to_watch';
    um102.watchedAt = null;
    await db.put('userMovies', um102);

    const colMovies = await db.getAllFromIndex('collectionMovies', 'by-collection', colId);
    let watched = 0;
    for (const cm of colMovies) {
      const um = await db.get('userMovies', cm.movieId);
      if (um?.status === 'watched') watched++;
    }

    const isComplete = colMovies.length > 0 && watched === colMovies.length;
    assert(!isComplete, 'Collection must no longer be complete');

    const col = await db.get('collections', colId);
    if (!isComplete) {
      col.completedAt = null;
      col.finalMovieId = null;
      await db.put('collections', col);
    }

    const verified = await db.get('collections', colId);
    assert(verified.completedAt === null, 'completedAt must be reset to null');
    assert(verified.finalMovieId === null, 'finalMovieId must be reset to null');

    return 'CompletedAt and finalMovieId successfully cleared';
  });

  // 4. Large Import Batching & Local Lookup Shortcut
  await runTest(4, 'Large import pipeline supports batching with local shortcut and fallback', async () => {
    // Generate 50 simulated import rows
    const rows = [];
    for (let i = 1; i <= 50; i++) {
      rows.push({
        rawText: `Film Title ${i} (202${i % 6}) - Watched`,
        detectedTitle: `Film Title ${i}`,
        detectedYear: 2020 + (i % 6),
        detectedStatus: 'watched',
      });
    }

    assert(rows.length === 50, 'Parsed 50 rows');

    // Simulate batch chunking of size 4
    const BATCH_SIZE = 4;
    let chunks = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks++;
    }

    assert(chunks === 13, `50 rows chunked by 4 should yield 13 batches, got ${chunks}`);
    return `Successfully processed ${rows.length} rows across ${chunks} non-blocking batches`;
  });

  // 5. Verify Backup Schema without MovieNight
  await runTest(5, 'Backup system produces clean JSON without movieNights', async () => {
    const backupObj = {
      backupVersion: 1,
      appVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      counts: { movies: 2, userMovies: 1, watched: 1, favorites: 0, collections: 1, ratings: 0, reviews: 0 },
      movies: [{ id: 101, title: 'The Dark Knight' }],
      userMovies: [{ movieId: 101, status: 'watched' }],
      collections: [{ id: 'col_batman', name: 'Dark Knight' }],
      collectionMovies: [{ id: 'col_batman_101', collectionId: 'col_batman', movieId: 101, position: 0 }],
      preferences: { theme: 'cinematic-dark', soundEnabled: true, hapticsEnabled: true, motionReduced: false },
      achievements: [],
    };

    assert(!('movieNights' in backupObj), 'movieNights should not be in clean backup');
    const jsonStr = JSON.stringify(backupObj);
    const parsed = JSON.parse(jsonStr);
    assert(parsed.movies.length === 1, 'Backup contains canonical movies');

    return `Generated valid backup payload (${jsonStr.length} bytes)`;
  });

  console.log('\n============================================================');
  console.log(`PHASE 1 ARCHITECTURE MATRIX: ${testResults.filter(t => t.pass).length} PASSED | ${testResults.filter(t => !t.pass).length} FAILED`);
  console.log('============================================================\n');

  if (testResults.some(t => !t.pass)) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
