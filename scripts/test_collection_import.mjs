import 'fake-indexeddb/auto';
import { openDB } from 'idb';

async function run() {
  console.log('--- TESTING FULL COLLECTION IMPORT WORKFLOW ---');

  const DB_NAME = 'personal-cinema-db';
  const DB_VERSION = 1;

  // Initialize DB with schema identical to src/db/schema.ts
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('movies')) {
        database.createObjectStore('movies', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('userMovies')) {
        const umStore = database.createObjectStore('userMovies', { keyPath: 'movieId' });
        umStore.createIndex('by-status', 'status');
        umStore.createIndex('by-watchedAt', 'watchedAt');
      }
      if (!database.objectStoreNames.contains('collections')) {
        database.createObjectStore('collections', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('collectionMovies')) {
        const cmStore = database.createObjectStore('collectionMovies', { keyPath: 'id' });
        cmStore.createIndex('by-collection', 'collectionId');
        cmStore.createIndex('by-movie', 'movieId');
      }
      if (!database.objectStoreNames.contains('preferences')) {
        database.createObjectStore('preferences', { keyPath: 'key' });
      }
    },
  });

  // 1. Create a target collection: "Cyberpunk Showcase"
  const colId = 'col_cyberpunk_2026';
  const newCol = {
    id: colId,
    name: 'Cyberpunk Showcase',
    description: 'Neon noir dystopian classics',
    coverType: 'collage',
    sortMode: 'custom',
    customOrder: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.put('collections', newCol);
  console.log('✓ Created target collection:', newCol.name);

  // 2. Simulate raw movie rows extracted from a user CSV file
  const rawCSV = [
    { detectedTitle: 'Blade Runner', detectedYear: 1982, detectedStatus: 'watched', detectedRating: 5 },
    { detectedTitle: 'The Matrix', detectedYear: 1999, detectedStatus: 'watched', detectedRating: 4.5 },
    { detectedTitle: 'Akira', detectedYear: 1988, detectedStatus: 'want_to_watch', detectedRating: null },
    { detectedTitle: 'Ghost in the Shell', detectedYear: 1995, detectedStatus: 'want_to_watch', detectedRating: null },
  ];

  // 3. Match candidates with canonical movie objects
  const candidateMovies = [
    {
      id: 78,
      title: 'Blade Runner',
      releaseDate: '1982-06-25',
      overview: 'A blade runner must pursue and terminate four replicants.',
      posterPath: '/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg',
      voteAverage: 7.9,
    },
    {
      id: 603,
      title: 'The Matrix',
      releaseDate: '1999-03-30',
      overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker.',
      posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      voteAverage: 8.2,
    },
    {
      id: 149,
      title: 'Akira',
      releaseDate: '1988-07-16',
      overview: 'A secret military project endangers Neo-Tokyo.',
      posterPath: '/neZ0jjQ47nbtT09kmk196b059om.jpg',
      voteAverage: 8.0,
    },
    {
      id: 9323,
      title: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
      overview: 'In the year 2029, the barriers of our world have been broken down.',
      posterPath: '/9gC88zvsUBXN59fgnrL9iZfubd.jpg',
      voteAverage: 7.9,
    },
  ];

  // 4. Execute atomic transaction commit to DB targeting the collection
  const now = new Date().toISOString();
  const tx = db.transaction(['movies', 'userMovies', 'collections', 'collectionMovies'], 'readwrite');
  const movieStore = tx.objectStore('movies');
  const userMovieStore = tx.objectStore('userMovies');
  const colStore = tx.objectStore('collections');
  const cmStore = tx.objectStore('collectionMovies');

  const targetCol = await colStore.get(colId);
  let pos = 0;

  for (let i = 0; i < candidateMovies.length; i++) {
    const m = candidateMovies[i];
    const row = rawCSV[i];

    // Put movie
    await movieStore.put(m);

    // Put userMovie
    await userMovieStore.put({
      movieId: m.id,
      status: row.detectedStatus,
      personalRating: row.detectedRating,
      notes: null,
      review: null,
      isFavorite: false,
      addedAt: now,
      watchedAt: row.detectedStatus === 'watched' ? now : null,
      watchingAt: null,
      scheduledAt: null,
      rewatchCount: 0,
    });

    // Put collectionMovie
    await cmStore.put({
      id: `${colId}_${m.id}`,
      collectionId: colId,
      movieId: m.id,
      position: pos++,
      addedAt: now,
    });
    targetCol.customOrder.push(m.id);
  }

  targetCol.updatedAt = now;
  await colStore.put(targetCol);
  await tx.done;

  console.log('✓ Atomic transaction committed 4 movies into collection');

  // 5. Verify database records
  const allMovies = await db.getAll('movies');
  console.log(`✓ Movies store count: ${allMovies.length} (Expected: 4)`);
  if (allMovies.length !== 4) throw new Error('Movies store count mismatch');

  const allUserMovies = await db.getAll('userMovies');
  console.log(`✓ UserMovies store count: ${allUserMovies.length} (Expected: 4)`);
  if (allUserMovies.length !== 4) throw new Error('UserMovies store count mismatch');

  const collectionMovies = await db.getAllFromIndex('collectionMovies', 'by-collection', colId);
  console.log(`✓ CollectionMovies store count for ${colId}: ${collectionMovies.length} (Expected: 4)`);
  if (collectionMovies.length !== 4) throw new Error('CollectionMovies count mismatch');

  const updatedCol = await db.get('collections', colId);
  console.log(`✓ Updated collection customOrder length: ${updatedCol.customOrder.length}`);
  if (updatedCol.customOrder.length !== 4) throw new Error('Collection customOrder mismatch');

  // 6. Test persistence across DB connection close & re-open
  db.close();
  const reopenedDB = await openDB(DB_NAME, DB_VERSION);
  const reloadedColMovies = await reopenedDB.getAllFromIndex('collectionMovies', 'by-collection', colId);
  console.log(`✓ Post-reopen collection movie count: ${reloadedColMovies.length} (Expected: 4)`);
  if (reloadedColMovies.length !== 4) throw new Error('Persistence failed after reopen');
  reopenedDB.close();

  console.log('============================================================');
  console.log('ALL COLLECTION IMPORT WORKFLOW VERIFICATIONS PASSED 100%');
  console.log('============================================================');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
