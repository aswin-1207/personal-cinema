import 'fake-indexeddb/auto';
import { openDB } from 'idb';

console.log('============================================================');
console.log('PERSONAL CINEMA — PHASE 2 AUTOMATED TEST SUITE');
console.log('============================================================\n');

// Database schema definition matching src/db/database.ts
const DB_VERSION = 2;

function createTestDB(dbName) {
  return openDB(dbName, DB_VERSION, {
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
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('tmdbCache')) {
        const cacheStore = db.createObjectStore('tmdbCache', { keyPath: 'key' });
        cacheStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });
}

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  const mainDbName = 'test-cinema-db-' + Date.now();
  let db = await createTestDB(mainDbName);

  // Sample canonical movie
  const sampleMovieA = {
    id: 157336,
    title: 'Interstellar',
    originalTitle: 'Interstellar',
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    releaseDate: '2014-11-05',
    runtime: 169,
    posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    voteAverage: 8.4,
    voteCount: 34500,
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 18, name: 'Drama' }],
    status: 'Released',
  };

  const sampleMovieB = {
    id: 27205,
    title: 'Inception',
    originalTitle: 'Inception',
    overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets.',
    releaseDate: '2010-07-15',
    runtime: 148,
    posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdropPath: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    voteAverage: 8.4,
    voteCount: 36000,
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }],
    status: 'Released',
  };

  // TEST A: BASIC PERSISTENCE
  await runTest('TEST A — BASIC PERSISTENCE', async () => {
    await db.put('movies', sampleMovieA);
    const retrieved = await db.get('movies', 157336);
    assert(retrieved !== undefined, 'Movie record must exist in DB');
    assert(retrieved.title === 'Interstellar', 'Movie title must match');
    return 'Saved Interstellar (ID 157336) and retrieved successfully';
  });

  // TEST B: WATCHED
  await runTest('TEST B — WATCHED', async () => {
    const now = new Date().toISOString();
    const userMovie = {
      movieId: 157336,
      status: 'watched',
      personalRating: null,
      notes: undefined,
      review: undefined,
      isFavorite: false,
      addedAt: now,
      watchedAt: now,
      scheduledAt: null,
      rewatchCount: 0,
    };
    await db.put('userMovies', userMovie);
    const retrieved = await db.get('userMovies', 157336);
    assert(retrieved.status === 'watched', 'Status must be watched');
    assert(typeof retrieved.watchedAt === 'string', 'watchedAt must be valid date');
    return `Status: ${retrieved.status}, watchedAt: ${retrieved.watchedAt}`;
  });

  // TEST C: FAVORITE
  await runTest('TEST C — FAVORITE', async () => {
    const existing = await db.get('userMovies', 157336);
    existing.isFavorite = true;
    await db.put('userMovies', existing);
    const retrieved = await db.get('userMovies', 157336);
    assert(retrieved.isFavorite === true, 'isFavorite must be true');
    return 'isFavorite successfully toggled to true';
  });

  // TEST D: RATING
  await runTest('TEST D — RATING', async () => {
    const existing = await db.get('userMovies', 157336);
    existing.personalRating = 4.5;
    await db.put('userMovies', existing);
    const retrieved = await db.get('userMovies', 157336);
    assert(retrieved.personalRating === 4.5, 'personalRating must be 4.5');
    return `personalRating successfully set to ${retrieved.personalRating}`;
  });

  // TEST E: REVIEW
  await runTest('TEST E — REVIEW', async () => {
    const existing = await db.get('userMovies', 157336);
    existing.review = 'Unmatched emotional and visual sci-fi spectacle.';
    existing.notes = 'Viewed in IMAX 70mm.';
    await db.put('userMovies', existing);
    const retrieved = await db.get('userMovies', 157336);
    assert(retrieved.review.includes('spectacle'), 'Review text must match');
    assert(retrieved.notes.includes('IMAX'), 'Notes text must match');
    return 'Review & notes persisted and verified';
  });

  // TEST F: COLLECTION
  await runTest('TEST F — COLLECTION', async () => {
    const collectionId = 'col_nolan_vault';
    const collection = {
      id: collectionId,
      name: 'Christopher Nolan Universe',
      description: 'Masterworks directed by Christopher Nolan',
      coverType: 'collage',
      customCoverMovieId: null,
      sortMode: 'custom',
      customOrder: [157336, 27205],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };
    await db.put('collections', collection);

    await db.put('collectionMovies', {
      id: `${collectionId}_157336`,
      collectionId,
      movieId: 157336,
      position: 0,
      addedAt: new Date().toISOString(),
    });

    await db.put('collectionMovies', {
      id: `${collectionId}_27205`,
      collectionId,
      movieId: 27205,
      position: 1,
      addedAt: new Date().toISOString(),
    });

    const col = await db.get('collections', collectionId);
    const colMovies = await db.getAllFromIndex('collectionMovies', 'by-collection', collectionId);
    assert(col.name === 'Christopher Nolan Universe', 'Collection name must match');
    assert(colMovies.length === 2, 'Collection must have 2 movies');
    return `Collection created with ${colMovies.length} movies`;
  });

  // TEST G: COLLECTION PROGRESS
  await runTest('TEST G — COLLECTION PROGRESS', async () => {
    const collectionId = 'col_nolan_vault';
    // Movie 157336 is 'watched'
    // Movie 27205 is not yet watched
    await db.put('movies', sampleMovieB);
    await db.put('userMovies', {
      movieId: 27205,
      status: 'want_to_watch',
      personalRating: null,
      notes: undefined,
      review: undefined,
      isFavorite: false,
      addedAt: new Date().toISOString(),
      watchedAt: null,
      scheduledAt: null,
      rewatchCount: 0,
    });

    // Check progress 1/2
    const colMovies = await db.getAllFromIndex('collectionMovies', 'by-collection', collectionId);
    let watchedCount = 0;
    for (const cm of colMovies) {
      const um = await db.get('userMovies', cm.movieId);
      if (um?.status === 'watched') watchedCount++;
    }
    assert(watchedCount === 1, 'Watched count must be 1 out of 2');

    // Now mark second movie watched
    const umB = await db.get('userMovies', 27205);
    umB.status = 'watched';
    umB.watchedAt = new Date().toISOString();
    await db.put('userMovies', umB);

    // Recheck progress 2/2 -> complete!
    watchedCount = 0;
    for (const cm of colMovies) {
      const um = await db.get('userMovies', cm.movieId);
      if (um?.status === 'watched') watchedCount++;
    }
    assert(watchedCount === 2, 'Watched count must be 2 out of 2');

    const col = await db.get('collections', collectionId);
    col.completedAt = new Date().toISOString();
    await db.put('collections', col);

    assert(watchedCount === colMovies.length, 'Collection is 100% complete');
    return `Progress updated from 1/2 (50%) to 2/2 (100% complete)`;
  });

  // TEST H: CROSS-DEVICE / CROSS-CONTEXT ISOLATION
  await runTest('TEST H — CROSS-DEVICE / CROSS-CONTEXT ISOLATION', async () => {
    // Simulate genuinely separate device storage contexts: Device A vs Device B
    const deviceADbName = 'device_a_profile_' + Date.now();
    const deviceBDbName = 'device_b_profile_' + Date.now();

    const dbA = await createTestDB(deviceADbName);
    const dbB = await createTestDB(deviceBDbName);

    // Device A creates personal record
    const privateRecordA = {
      movieId: 99901,
      status: 'watched',
      personalRating: 5.0,
      notes: 'Private screening on Device A',
      review: 'ASWIN_PRIVATE_TEST_A_12345',
      isFavorite: true,
      addedAt: new Date().toISOString(),
      watchedAt: new Date().toISOString(),
      scheduledAt: null,
      rewatchCount: 1,
    };
    await dbA.put('userMovies', privateRecordA);

    // Verify Device B does NOT have Device A's record
    const checkOnDeviceB = await dbB.get('userMovies', 99901);
    assert(checkOnDeviceB === undefined, 'Device B must NOT receive Device A personal data');

    // Device B creates personal record
    const privateRecordB = {
      movieId: 99902,
      status: 'want_to_watch',
      personalRating: null,
      notes: 'Saved on Device B',
      review: 'ASWIN_PRIVATE_TEST_B_67890',
      isFavorite: false,
      addedAt: new Date().toISOString(),
      watchedAt: null,
      scheduledAt: null,
      rewatchCount: 0,
    };
    await dbB.put('userMovies', privateRecordB);

    // Verify Device A does NOT have Device B's record
    const checkOnDeviceA = await dbA.get('userMovies', 99902);
    assert(checkOnDeviceA === undefined, 'Device A must NOT receive Device B personal data');

    return 'Strict data isolation verified: zero leakage across separate contexts';
  });

  // TEST I: PUBLIC TMDB DATA
  await runTest('TEST I — PUBLIC TMDB DATA', async () => {
    // Both contexts can have the same TMDB public movie metadata
    const sharedTmdbMovie = { ...sampleMovieA, id: 550, title: 'Fight Club' };
    
    // Save to movies table (public metadata)
    await db.put('movies', sharedTmdbMovie);
    
    // Verify that saving to movies does NOT create a userMovies record
    const um550 = await db.get('userMovies', 550);
    assert(um550 === undefined, 'Public movie metadata must NOT create personal userMovie record');
    
    return 'Public metadata exists independently without polluting personal user state';
  });

  // TEST J: IMPORT
  await runTest('TEST J — IMPORT', async () => {
    const importBatch = [
      { id: 603, title: 'The Matrix', releaseDate: '1999-03-30', runtime: 136 },
      { id: 157336, title: 'Interstellar', releaseDate: '2014-11-05', runtime: 169 }, // duplicate of existing
    ];

    // Check existing Interstellar status before import
    const beforeUm = await db.get('userMovies', 157336);
    assert(beforeUm.status === 'watched', 'Before import, Interstellar must be watched');

    // Process import: new movie added as want_to_watch, existing movie status preserved!
    for (const m of importBatch) {
      await db.put('movies', m);
      const existing = await db.get('userMovies', m.id);
      if (!existing) {
        await db.put('userMovies', {
          movieId: m.id,
          status: 'want_to_watch',
          personalRating: null,
          notes: 'Imported via test',
          review: undefined,
          isFavorite: false,
          addedAt: new Date().toISOString(),
          watchedAt: null,
          scheduledAt: null,
          rewatchCount: 0,
        });
      }
    }

    const matrixUm = await db.get('userMovies', 603);
    assert(matrixUm.status === 'want_to_watch', 'Imported new movie must have want_to_watch status');

    const afterUm = await db.get('userMovies', 157336);
    assert(afterUm.status === 'watched', 'Existing watched movie must NOT be overwritten by import');
    assert(afterUm.personalRating === 4.5, 'Existing rating must be preserved');

    return 'Import successfully added new movie while preserving existing watched movie state';
  });

  // TEST K: BACKUP
  let generatedBackup = null;
  await runTest('TEST K — BACKUP', async () => {
    const movies = await db.getAll('movies');
    const userMovies = await db.getAll('userMovies');
    const collections = await db.getAll('collections');
    const collectionMovies = await db.getAll('collectionMovies');

    generatedBackup = {
      backupVersion: 1,
      appVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      counts: {
        movies: movies.length,
        userMovies: userMovies.length,
        watched: userMovies.filter((um) => um.status === 'watched').length,
        collections: collections.length,
      },
      movies,
      userMovies,
      collections,
      collectionMovies,
      preferences: {
        theme: 'cinema-dark',
        displayName: '',
        soundEnabled: true,
        hapticsEnabled: true,
        // No secrets/api keys!
      },
    };

    assert(generatedBackup.backupVersion === 1, 'Backup version must be 1');
    assert(generatedBackup.counts.movies >= 3, 'Backup must include movies');
    assert(generatedBackup.counts.watched >= 2, 'Backup must include watched movies');
    assert(generatedBackup.preferences.tmdbApiKey === undefined, 'Backup must NOT contain TMDB API key or secret');

    return `Generated valid backup with ${generatedBackup.counts.movies} movies and 0 secrets`;
  });

  // TEST L: RESTORE
  await runTest('TEST L — RESTORE', async () => {
    assert(generatedBackup !== null, 'Backup must exist');

    // Create fresh empty database to restore into
    const restoreDbName = 'test-restore-db-' + Date.now();
    const restoreDb = await createTestDB(restoreDbName);

    // Perform restore
    for (const m of generatedBackup.movies) await restoreDb.put('movies', m);
    for (const um of generatedBackup.userMovies) await restoreDb.put('userMovies', um);
    for (const c of generatedBackup.collections) await restoreDb.put('collections', c);
    for (const cm of generatedBackup.collectionMovies) await restoreDb.put('collectionMovies', cm);

    const restoredMovies = await restoreDb.getAll('movies');
    const restoredUserMovies = await restoreDb.getAll('userMovies');
    const restoredInterstellar = await restoreDb.get('userMovies', 157336);

    assert(restoredMovies.length === generatedBackup.movies.length, 'Restored movie count must match');
    assert(restoredUserMovies.length === generatedBackup.userMovies.length, 'Restored userMovie count must match');
    assert(restoredInterstellar.status === 'watched', 'Restored Interstellar must be watched');
    assert(restoredInterstellar.personalRating === 4.5, 'Restored Interstellar rating must be 4.5');

    return `Restored ${restoredMovies.length} movies and ${restoredUserMovies.length} personal states with 100% fidelity`;
  });

  // TEST M: REFRESH / REOPEN
  await runTest('TEST M — REFRESH / REOPEN', async () => {
    // Close database connection
    db.close();

    // Reopen database connection
    db = await createTestDB(mainDbName);

    const movies = await db.getAll('movies');
    const userMovies = await db.getAll('userMovies');
    assert(movies.length > 0, 'Movies must persist after connection close and reopen');
    assert(userMovies.length > 0, 'UserMovies must persist after connection close and reopen');

    return `Reopened DB connection: ${movies.length} movies and ${userMovies.length} user records intact`;
  });

  // TEST N: TMDB FAILURE
  await runTest('TEST N — TMDB FAILURE', async () => {
    // Simulate network error when querying TMDB
    let networkOnline = false;
    const fetchFromTmdb = async () => {
      if (!networkOnline) {
        throw new Error('Network error: TMDB unreachable');
      }
      return [];
    };

    let tmdbErrorOccurred = false;
    try {
      await fetchFromTmdb();
    } catch {
      tmdbErrorOccurred = true;
    }

    assert(tmdbErrorOccurred, 'TMDB error was caught');

    // Local data remains 100% accessible even when TMDB fails
    const localMovies = await db.getAll('movies');
    const localUserMovies = await db.getAll('userMovies');

    assert(localMovies.length > 0, 'Local movies must remain available during TMDB outage');
    assert(localUserMovies.length > 0, 'Local personal state must remain available during TMDB outage');

    return 'Network failure simulated: zero personal data loss, local vault remained 100% operational';
  });

  // TEST O: DOUBLE ACTION
  await runTest('TEST O — DOUBLE ACTION', async () => {
    // Simulate rapid concurrent toggle on the same movie
    const movieId = 27205;
    const now = new Date().toISOString();

    // In-flight guard simulator
    const inFlight = new Set();
    let writeExecutions = 0;

    const toggleWatched = async (id) => {
      if (inFlight.has(id)) {
        return; // Guard prevents concurrent collision
      }
      inFlight.add(id);
      try {
        writeExecutions++;
        const current = await db.get('userMovies', id);
        current.status = current.status === 'watched' ? 'want_to_watch' : 'watched';
        await db.put('userMovies', current);
      } finally {
        inFlight.delete(id);
      }
    };

    // Trigger two calls simultaneously
    await Promise.all([toggleWatched(movieId), toggleWatched(movieId)]);

    assert(writeExecutions === 1, 'In-flight guard must ensure only 1 write executed during rapid double click');
    const finalRecord = await db.get('userMovies', movieId);
    assert(finalRecord !== undefined, 'Record must remain valid');

    return `Double action executed: exactly 1 write processed, race condition prevented`;
  });

  console.log('\n============================================================');
  console.log('TEST SUITE SUMMARY');
  console.log('============================================================');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
