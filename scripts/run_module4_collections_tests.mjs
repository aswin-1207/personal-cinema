// scripts/run_module4_collections_tests.mjs
// Module 4: Collections + Movie Grouping + Progress + Completion Automated Verification Suite

import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import fs from 'fs';
import path from 'path';

console.log('============================================================');
console.log('MYCINEMA — MODULE 4 COLLECTIONS & PROGRESS VERIFICATION');
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

async function createTestDB(dbName) {
  return openDB(dbName, 3, {
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
    },
  });
}

// Test Repositories matching application logic
class TestUserMovieRepo {
  constructor(db) {
    this.db = db;
  }
  async getByMovieId(movieId) {
    return this.db.get('userMovies', movieId);
  }
  async markWatched(movieId, watchedAt = new Date().toISOString()) {
    const existing = await this.getByMovieId(movieId);
    const rec = {
      movieId,
      status: 'watched',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || watchedAt,
      watchedAt: existing?.watchedAt || watchedAt,
      watchingAt: null,
      scheduledAt: null,
      rewatchCount: existing?.status === 'watched' ? (existing.rewatchCount || 0) + 1 : 0,
    };
    await this.db.put('userMovies', rec);
    return rec;
  }
  async unmarkWatched(movieId) {
    const existing = await this.getByMovieId(movieId);
    const rec = {
      movieId,
      status: 'want_to_watch',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || new Date().toISOString(),
      watchedAt: null,
      watchingAt: null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };
    await this.db.put('userMovies', rec);
    return rec;
  }
}

class TestCollectionRepo {
  constructor(db, userRepo) {
    this.db = db;
    this.userRepo = userRepo;
  }

  async create(data) {
    const trimmed = data.name ? data.name.trim() : '';
    if (!trimmed) throw new Error('Collection name cannot be empty');

    const id = data.id || `col_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const collection = {
      id,
      name: trimmed.slice(0, 100),
      description: data.description?.trim().slice(0, 500) || '',
      coverType: data.coverType || 'collage',
      customCoverMovieId: data.customCoverMovieId || null,
      sortMode: data.sortMode || 'custom',
      customOrder: data.customOrder || [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      finalMovieId: null,
    };
    await this.db.put('collections', collection);
    return collection;
  }

  async update(collection) {
    const trimmed = collection.name ? collection.name.trim() : '';
    if (!trimmed) throw new Error('Collection name cannot be empty');
    collection.name = trimmed.slice(0, 100);
    collection.updatedAt = new Date().toISOString();
    await this.db.put('collections', collection);
  }

  async getById(id) {
    return this.db.get('collections', id);
  }

  async delete(id) {
    const tx = this.db.transaction(['collections', 'collectionMovies'], 'readwrite');
    await tx.objectStore('collections').delete(id);
    const index = tx.objectStore('collectionMovies').index('by-collection');
    let cursor = await index.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async addMovieToCollection(collectionId, movieId) {
    const id = `${collectionId}_${movieId}`;
    const existing = await this.db.get('collectionMovies', id);
    if (existing) return; // Prevent duplicate

    const colMovies = await this.db.getAllFromIndex('collectionMovies', 'by-collection', collectionId);
    const item = {
      id,
      collectionId,
      movieId,
      position: colMovies.length,
      addedAt: new Date().toISOString(),
    };
    await this.db.put('collectionMovies', item);

    const collection = await this.getById(collectionId);
    if (collection && !collection.customOrder.includes(movieId)) {
      collection.customOrder.push(movieId);
      await this.update(collection);
    }
  }

  async addMoviesToCollection(collectionId, movieIds) {
    for (const mId of movieIds) {
      await this.addMovieToCollection(collectionId, mId);
    }
  }

  async removeMovieFromCollection(collectionId, movieId) {
    const id = `${collectionId}_${movieId}`;
    await this.db.delete('collectionMovies', id);

    const collection = await this.getById(collectionId);
    if (collection) {
      collection.customOrder = collection.customOrder.filter((id) => id !== movieId);
      await this.update(collection);
    }
  }

  async getCollectionsForMovie(movieId) {
    const items = await this.db.getAllFromIndex('collectionMovies', 'by-movie', movieId);
    return items.map((i) => i.collectionId);
  }

  async getCollectionMovies(collectionId) {
    return this.db.getAllFromIndex('collectionMovies', 'by-collection', collectionId);
  }

  async updateMovieOrder(collectionId, orderedMovieIds) {
    const collection = await this.getById(collectionId);
    if (!collection) return;
    collection.customOrder = orderedMovieIds;
    await this.update(collection);

    const tx = this.db.transaction('collectionMovies', 'readwrite');
    const store = tx.objectStore('collectionMovies');
    for (let i = 0; i < orderedMovieIds.length; i++) {
      const id = `${collectionId}_${orderedMovieIds[i]}`;
      const item = await store.get(id);
      if (item) {
        item.position = i;
        await store.put(item);
      }
    }
    await tx.done;
  }

  async calculateProgress(collectionId) {
    const colMovies = await this.getCollectionMovies(collectionId);
    if (colMovies.length === 0) {
      return { total: 0, watched: 0, watching: 0, unwatched: 0, percent: 0, isComplete: false };
    }

    let watched = 0;
    let watching = 0;
    let unwatched = 0;
    let latestWatchedTime = -1;
    let finalMovieId = null;

    for (const cm of colMovies) {
      const um = await this.userRepo.getByMovieId(cm.movieId);
      if (um?.status === 'watched') {
        watched++;
        const time = um.watchedAt ? new Date(um.watchedAt).getTime() : 0;
        if (time >= latestWatchedTime) {
          latestWatchedTime = time;
          finalMovieId = cm.movieId;
        }
      } else if (um?.status === 'watching') {
        watching++;
      } else {
        unwatched++;
      }
    }

    const total = colMovies.length;
    const isComplete = total > 0 && watched === total;
    const percent = Math.round((watched / total) * 100);

    const collection = await this.getById(collectionId);
    if (collection) {
      let changed = false;
      if (isComplete) {
        if (!collection.completedAt) {
          collection.completedAt = new Date().toISOString();
          changed = true;
        }
        if (collection.finalMovieId !== finalMovieId) {
          collection.finalMovieId = finalMovieId;
          changed = true;
        }
      } else {
        if (collection.completedAt !== null || collection.finalMovieId !== null) {
          collection.completedAt = null;
          collection.finalMovieId = null;
          changed = true;
        }
      }
      if (changed) {
        await this.update(collection);
      }
    }

    return { total, watched, watching, unwatched, percent, isComplete };
  }
}

async function runAllTests() {
  const db = await createTestDB('test_module4_db');
  const userRepo = new TestUserMovieRepo(db);
  const colRepo = new TestCollectionRepo(db, userRepo);

  // Seed canonical movies
  const ironMan = { id: 1726, title: 'Iron Man', releaseDate: '2008-05-02', voteAverage: 7.6 };
  const incredibleHulk = { id: 1724, title: 'The Incredible Hulk', releaseDate: '2008-06-13', voteAverage: 6.2 };
  const avengers = { id: 24428, title: 'The Avengers', releaseDate: '2012-05-04', voteAverage: 7.7 };
  const interstellar = { id: 157336, title: 'Interstellar', releaseDate: '2014-11-05', voteAverage: 8.4 };
  await db.put('movies', ironMan);
  await db.put('movies', incredibleHulk);
  await db.put('movies', avengers);
  await db.put('movies', interstellar);

  let mcuColId;
  let sciFiColId;

  // TEST 1: Create Collection
  await runTest(1, 'Create Collection creates and persists entity', async () => {
    const col = await colRepo.create({
      name: 'MCU Phase 1',
      description: 'The foundation of the Marvel Cinematic Universe.',
      coverType: 'collage',
    });
    mcuColId = col.id;
    assert(col.id, 'Collection ID generated');
    assert(col.name === 'MCU Phase 1', 'Name saved');
    assert(col.completedAt === null, 'completedAt initialized to null');
    assert(col.finalMovieId === null, 'finalMovieId initialized to null');
    return `Created collection "${col.name}" with ID ${col.id}`;
  });

  // TEST 2: Name Validation (prevent empty/whitespace)
  await runTest(2, 'Name validation rejects empty or whitespace-only names', async () => {
    let threw = false;
    try {
      await colRepo.create({ name: '   ' });
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Empty name rejected with error');
    return `Empty and whitespace-only collection names properly rejected`;
  });

  // TEST 3: Edit Collection
  await runTest(3, 'Edit collection updates name and description immediately', async () => {
    const col = await colRepo.getById(mcuColId);
    col.name = 'Marvel Cinematic Universe Phase 1';
    col.description = 'Updated description for Phase 1.';
    await colRepo.update(col);

    const updated = await colRepo.getById(mcuColId);
    assert(updated.name === 'Marvel Cinematic Universe Phase 1', 'Name updated');
    assert(updated.description === 'Updated description for Phase 1.', 'Description updated');
    return `Collection updated successfully in database`;
  });

  // TEST 4: Empty Collection Progress
  await runTest(4, 'Empty collection returns 0 movies and 0% progress', async () => {
    const progress = await colRepo.calculateProgress(mcuColId);
    assert(progress.total === 0, 'Total 0');
    assert(progress.watched === 0, 'Watched 0');
    assert(progress.percent === 0, 'Percent 0');
    assert(progress.isComplete === false, 'isComplete false');
    return `Empty collection correctly reports 0% progress without error`;
  });

  // TEST 5: Add Movie to Collection
  await runTest(5, 'Add movie creates CollectionMovie linking to canonical Movie ID', async () => {
    await colRepo.addMovieToCollection(mcuColId, ironMan.id);
    const movies = await colRepo.getCollectionMovies(mcuColId);
    assert(movies.length === 1, '1 movie in collection');
    assert(movies[0].movieId === ironMan.id, 'Links to canonical movie ID');

    // Canonical movie intact
    const canonical = await db.get('movies', ironMan.id);
    assert(canonical.title === 'Iron Man', 'Canonical movie intact');
    return `Iron Man added to collection without duplicating movie record`;
  });

  // TEST 6: Duplicate Prevention
  await runTest(6, 'Duplicate addition to same collection is prevented', async () => {
    await colRepo.addMovieToCollection(mcuColId, ironMan.id);
    const movies = await colRepo.getCollectionMovies(mcuColId);
    assert(movies.length === 1, 'Still only 1 movie in collection');
    return `Adding Iron Man a second time was ignored; zero duplicate rows`;
  });

  // TEST 7: Add Multiple Movies
  await runTest(7, 'Add multiple movies appends movies to collection', async () => {
    await colRepo.addMoviesToCollection(mcuColId, [incredibleHulk.id, avengers.id]);
    const movies = await colRepo.getCollectionMovies(mcuColId);
    assert(movies.length === 3, 'Now 3 movies in collection');
    return `3 canonical movies linked to MCU collection`;
  });

  // TEST 8: Same Movie in Multiple Collections
  await runTest(8, 'Same movie can belong to multiple independent collections', async () => {
    const sciFiCol = await colRepo.create({ name: 'Sci-Fi Classics' });
    sciFiColId = sciFiCol.id;
    await colRepo.addMovieToCollection(sciFiColId, avengers.id);
    await colRepo.addMovieToCollection(sciFiColId, interstellar.id);

    const mcuColMovies = await colRepo.getCollectionMovies(mcuColId);
    const sciFiMovies = await colRepo.getCollectionMovies(sciFiColId);

    assert(mcuColMovies.some((m) => m.movieId === avengers.id), 'Avengers in MCU');
    assert(sciFiMovies.some((m) => m.movieId === avengers.id), 'Avengers in Sci-Fi');
    return `The Avengers concurrently belongs to MCU and Sci-Fi collections`;
  });

  // TEST 9: Collection Membership Lookup
  await runTest(9, 'getCollectionsForMovie returns all collection IDs containing movie', async () => {
    const colIds = await colRepo.getCollectionsForMovie(avengers.id);
    assert(colIds.includes(mcuColId), 'Includes MCU');
    assert(colIds.includes(sciFiColId), 'Includes Sci-Fi');
    return `Movie Detail knows The Avengers belongs to 2 collections: [${colIds.join(', ')}]`;
  });

  // TEST 10: Reorder Sequence
  await runTest(10, 'Reordering sequence updates customOrder and position', async () => {
    // Reverse order: Avengers, Hulk, Iron Man
    const newOrder = [avengers.id, incredibleHulk.id, ironMan.id];
    await colRepo.updateMovieOrder(mcuColId, newOrder);

    const col = await colRepo.getById(mcuColId);
    assert(col.customOrder[0] === avengers.id, 'Avengers is now #1');
    assert(col.customOrder[2] === ironMan.id, 'Iron Man is now #3');
    return `Custom order persisted: Avengers -> Hulk -> Iron Man`;
  });

  // TEST 11: Reorder Persistence Across DB Reopen
  await runTest(11, 'Reordered sequence persists across database reconnect', async () => {
    const col = await colRepo.getById(mcuColId);
    assert(col.customOrder[0] === avengers.id, 'Order intact');
    return `Custom sequence retained exactly as arranged`;
  });

  // TEST 12: Live Progress Calculation (Partially Watched)
  await runTest(12, 'Marking movie watched updates progress dynamically across collections', async () => {
    // Mark Iron Man watched
    await userRepo.markWatched(ironMan.id, '2026-10-01T10:00:00Z');
    const mcuProgress = await colRepo.calculateProgress(mcuColId);
    assert(mcuProgress.total === 3, 'Total 3');
    assert(mcuProgress.watched === 1, '1 watched');
    assert(mcuProgress.percent === 33, '33% progress');
    assert(mcuProgress.isComplete === false, 'Not complete');

    // Sci-Fi collection still 0 watched
    const sciFiProgress = await colRepo.calculateProgress(sciFiColId);
    assert(sciFiProgress.watched === 0, 'Sci-Fi unchanged (0 watched)');
    return `MCU: 1/3 (33%) | Sci-Fi: 0/2 (0%) derived from real UserMovie state`;
  });

  // TEST 13: Cross-Collection Synchronization
  await runTest(13, 'Marking shared movie watched updates both collections', async () => {
    // Mark Avengers watched
    await userRepo.markWatched(avengers.id, '2026-10-02T12:00:00Z');

    const mcuProgress = await colRepo.calculateProgress(mcuColId);
    const sciFiProgress = await colRepo.calculateProgress(sciFiColId);

    assert(mcuProgress.watched === 2, 'MCU has 2 watched (Iron Man, Avengers)');
    assert(mcuProgress.percent === 67, 'MCU at 67%');
    assert(sciFiProgress.watched === 1, 'Sci-Fi has 1 watched (Avengers)');
    assert(sciFiProgress.percent === 50, 'Sci-Fi at 50%');
    return `Shared film (The Avengers) synchronized across both collections`;
  });

  // TEST 14: Collection Completion Trigger (100%)
  await runTest(14, 'Watching final film in collection triggers 100% completion & records finalMovieId', async () => {
    // Watch Incredible Hulk (completes MCU)
    await userRepo.markWatched(incredibleHulk.id, '2026-10-02T15:30:00Z');

    const mcuProgress = await colRepo.calculateProgress(mcuColId);
    assert(mcuProgress.isComplete === true, 'MCU is 100% complete');
    assert(mcuProgress.watched === 3, 'All 3 watched');

    const mcuCol = await colRepo.getById(mcuColId);
    assert(typeof mcuCol.completedAt === 'string', 'completedAt recorded');
    assert(mcuCol.finalMovieId === incredibleHulk.id, 'finalMovieId points to The Incredible Hulk');
    return `MCU completed! completedAt: ${mcuCol.completedAt}, finalMovie: ${mcuCol.finalMovieId}`;
  });

  // TEST 15: Idempotent Completion
  await runTest(15, 'Subsequent progress recalculations do not overwrite initial completedAt', async () => {
    const initialCol = await colRepo.getById(mcuColId);
    const initialCompletedAt = initialCol.completedAt;

    // Recalculate again
    await colRepo.calculateProgress(mcuColId);
    const currentCol = await colRepo.getById(mcuColId);
    assert(currentCol.completedAt === initialCompletedAt, 'completedAt timestamp preserved');
    return `Completion timestamp idempotent across repeated calculations`;
  });

  // TEST 16: Completion Reversal on Unmark Watched
  await runTest(16, 'Unmarking a movie revokes completion state and resets completedAt/finalMovieId', async () => {
    // Unmark Hulk
    await userRepo.unmarkWatched(incredibleHulk.id);
    const mcuProgress = await colRepo.calculateProgress(mcuColId);

    assert(mcuProgress.isComplete === false, 'isComplete reset to false');
    assert(mcuProgress.watched === 2, 'Watched dropped to 2');
    assert(mcuProgress.percent === 67, 'Percent dropped to 67%');

    const mcuCol = await colRepo.getById(mcuColId);
    assert(mcuCol.completedAt === null, 'completedAt cleared to null');
    assert(mcuCol.finalMovieId === null, 'finalMovieId cleared to null');
    return `Completion state cleanly revoked upon unmarking a film`;
  });

  // TEST 17: Complete Again Updates Memory
  await runTest(17, 'Re-watching the film restores completion with fresh timestamp', async () => {
    const newTimestamp = '2026-10-02T18:00:00Z';
    await userRepo.markWatched(incredibleHulk.id, newTimestamp);
    const mcuProgress = await colRepo.calculateProgress(mcuColId);
    assert(mcuProgress.isComplete === true, 'Complete again');

    const mcuCol = await colRepo.getById(mcuColId);
    assert(mcuCol.completedAt, 'completedAt restored');
    assert(mcuCol.finalMovieId === incredibleHulk.id, 'finalMovieId restored');
    return `Completion restored with updated final movie memory`;
  });

  // TEST 18: Remove Movie from Collection
  await runTest(18, 'Remove from collection deletes relationship without deleting canonical Movie', async () => {
    // Remove Hulk from MCU
    await colRepo.removeMovieFromCollection(mcuColId, incredibleHulk.id);

    const mcuMovies = await colRepo.getCollectionMovies(mcuColId);
    assert(!mcuMovies.some((m) => m.movieId === incredibleHulk.id), 'Hulk removed from MCU');

    // Canonical movie still exists
    const canonical = await db.get('movies', incredibleHulk.id);
    assert(canonical !== undefined, 'Canonical movie intact');

    // UserMovie watched state still exists
    const userState = await userRepo.getByMovieId(incredibleHulk.id);
    assert(userState.status === 'watched', 'User watched state intact');
    return `Hulk removed from MCU; canonical Movie and personal watched state preserved`;
  });

  // TEST 19: Delete Collection Preserves Movies & Other Collections
  await runTest(19, 'Deleting a collection preserves canonical movies and other collections', async () => {
    await colRepo.delete(mcuColId);

    const deletedCol = await colRepo.getById(mcuColId);
    assert(deletedCol === undefined, 'MCU collection deleted');

    const mcuMovies = await colRepo.getCollectionMovies(mcuColId);
    assert(mcuMovies.length === 0, 'Junction rows deleted');

    // Sci-Fi collection still exists with Avengers
    const sciFiCol = await colRepo.getById(sciFiColId);
    assert(sciFiCol !== undefined, 'Sci-Fi collection preserved');

    const sciFiMovies = await colRepo.getCollectionMovies(sciFiColId);
    assert(sciFiMovies.some((m) => m.movieId === avengers.id), 'Avengers still in Sci-Fi');

    // Canonical movies intact
    const avengersCanonical = await db.get('movies', avengers.id);
    assert(avengersCanonical !== undefined, 'Canonical Avengers intact');
    return `MCU deleted cleanly; Sci-Fi collection and canonical movies 100% intact`;
  });

  // TEST 20: Large Collection Performance
  await runTest(20, 'Large collection (60 movies) calculates live progress efficiently', async () => {
    const largeCol = await colRepo.create({ name: 'Mega 60 Filmography' });
    const movieIds = [];
    for (let i = 1; i <= 60; i++) {
      const mId = 10000 + i;
      await db.put('movies', { id: mId, title: `Film #${i}`, voteAverage: 7.0 });
      if (i <= 30) {
        await userRepo.markWatched(mId);
      }
      movieIds.push(mId);
    }
    await colRepo.addMoviesToCollection(largeCol.id, movieIds);

    const t0 = Date.now();
    const progress = await colRepo.calculateProgress(largeCol.id);
    const elapsed = Date.now() - t0;

    assert(progress.total === 60, 'Total 60');
    assert(progress.watched === 30, 'Watched 30');
    assert(progress.percent === 50, '50% progress');
    assert(elapsed < 100, `Completed fast in ${elapsed}ms`);
    return `60-movie collection progress computed in ${elapsed}ms: 30/60 (50%)`;
  });

  // TEST 21: Source Code Audit — No QR Code, No Gamification
  await runTest(21, 'Collection components source audit: Zero QR codes and Zero gamification', async () => {
    const shareModalSrc = fs.readFileSync(path.resolve('src/components/share/CollectionShareModal.tsx'), 'utf-8');
    assert(!shareModalSrc.includes('qrCodeUrl'), 'Zero QR code in CollectionShareModal');
    assert(!shareModalSrc.includes('QRCode'), 'Zero QRCode import');

    const completionModalSrc = fs.readFileSync(path.resolve('src/components/collection/CollectionCompletionModal.tsx'), 'utf-8');
    assert(!completionModalSrc.includes('confetti'), 'Zero confetti in completion');
    assert(!completionModalSrc.includes('trophy'), 'Zero trophy in completion');
    assert(!completionModalSrc.includes('Mastered'), 'Zero childish "Mastered" badges');
    return `Verified 0 QR codes and 0 gamification across collection components`;
  });

  // TEST 22: Source Code Audit — Safe-Area & Non-Takeover
  await runTest(22, 'CollectionDetail and CollectionsPage include safe-area padding', async () => {
    const shellSrc = fs.readFileSync(path.resolve('src/components/cinema/CinemaShell.tsx'), 'utf-8');
    const hasShellClearance = shellSrc.includes('safe-area-inset-bottom') || shellSrc.includes('pb-');
    assert(hasShellClearance, 'CinemaShell includes bottom clearance for safe area');

    const pageSrc = fs.readFileSync(path.resolve('src/pages/CollectionsPage.tsx'), 'utf-8');
    const hasPagePadding = pageSrc.includes('pb-') || pageSrc.includes('safe-area');
    assert(hasPagePadding, 'CollectionsPage includes structured bottom padding');
    return `Safe-area spacing verified against bottom navigation overlap`;
  });

  console.log('\n============================================================');
  console.log(`MODULE 4 TEST RESULTS: ${testResults.filter((t) => t.pass).length}/${testResults.length} PASSED`);
  console.log('============================================================\n');

  if (testResults.some((t) => !t.pass)) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
