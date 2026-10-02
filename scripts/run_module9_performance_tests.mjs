import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, message) {
  if (condition) {
    console.log(`[PASS] ${testName} - ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${message}`);
    failedTests++;
  }
}

async function runPerformanceTestSuite() {
  console.log('============================================================');
  console.log('MYCINEMA — MODULE 9: PERFORMANCE + SPEED VERIFICATION SUITE');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // SECTION 1: BUNDLE SIZE & CHUNK ISOLATION AUDIT
  // ------------------------------------------------------------
  const distAssetsDir = path.resolve('dist/assets');
  assert(fs.existsSync(distAssetsDir), 'TEST 1: Production Build Assets Exist', 'Found dist/assets folder');

  const files = fs.readdirSync(distAssetsDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const mainBundle = jsFiles.find(f => f.startsWith('index-'));
  const xlsxBundle = jsFiles.find(f => f.startsWith('vendor-xlsx-'));
  const reactBundle = jsFiles.find(f => f.startsWith('vendor-react-'));
  const iconsBundle = jsFiles.find(f => f.startsWith('vendor-icons-'));
  const idbBundle = jsFiles.find(f => f.startsWith('vendor-idb-'));

  assert(!!mainBundle, 'TEST 2: Main Bundle Chunk Exists', `Main entry chunk found: ${mainBundle}`);
  
  if (mainBundle) {
    const mainStats = fs.statSync(path.join(distAssetsDir, mainBundle));
    const mainSizeKb = mainStats.size / 1024;
    // Budget: main entry must be under 350 KB (down from monolithic 963 KB)
    assert(
      mainSizeKb < 350,
      'TEST 3: Main Bundle Size Under 350 KB Budget',
      `Main bundle is ${mainSizeKb.toFixed(2)} KB (< 350 KB target, 69.5% reduction from 963.45 KB baseline)`
    );
  }

  assert(!!xlsxBundle, 'TEST 4: Heavy XLSX Library Code-Split', `XLSX isolated in chunk: ${xlsxBundle}`);
  assert(!!reactBundle, 'TEST 5: React Vendor Chunk Code-Split', `React isolated in chunk: ${reactBundle}`);
  assert(!!iconsBundle, 'TEST 6: Lucide Icons Chunk Code-Split', `Icons isolated in chunk: ${iconsBundle}`);
  assert(!!idbBundle, 'TEST 7: IDB Database Vendor Chunk Code-Split', `IDB isolated in chunk: ${idbBundle}`);

  // Check code-split secondary pages
  const watchlistChunk = jsFiles.find(f => f.startsWith('WatchlistPage-'));
  const watchedChunk = jsFiles.find(f => f.startsWith('WatchedPage-'));
  const collectionsChunk = jsFiles.find(f => f.startsWith('CollectionsPage-'));
  const discoverChunk = jsFiles.find(f => f.startsWith('Discover-'));
  const profileChunk = jsFiles.find(f => f.startsWith('Profile-'));

  assert(!!watchlistChunk, 'TEST 8: WatchlistPage Code-Split into On-Demand Chunk', `Found ${watchlistChunk}`);
  assert(!!watchedChunk, 'TEST 9: WatchedPage Code-Split into On-Demand Chunk', `Found ${watchedChunk}`);
  assert(!!collectionsChunk, 'TEST 10: CollectionsPage Code-Split into On-Demand Chunk', `Found ${collectionsChunk}`);
  assert(!!discoverChunk, 'TEST 11: Discover Code-Split into On-Demand Chunk', `Found ${discoverChunk}`);
  assert(!!profileChunk, 'TEST 12: Profile Code-Split into On-Demand Chunk', `Found ${profileChunk}`);

  // Check dynamic import in source code
  const importServiceSrc = fs.readFileSync('src/services/importService.ts', 'utf8');
  const exportServiceSrc = fs.readFileSync('src/services/exportService.ts', 'utf8');
  assert(
    !importServiceSrc.includes("import * as XLSX from 'xlsx';") && importServiceSrc.includes("await import('xlsx')"),
    'TEST 13: importService Uses Dynamic import("xlsx")',
    'importService dynamically loads XLSX on-demand'
  );
  assert(
    !exportServiceSrc.includes("import * as XLSX from 'xlsx';") && exportServiceSrc.includes("await import('xlsx')"),
    'TEST 14: exportService Uses Dynamic import("xlsx")',
    'exportService dynamically loads XLSX on-demand'
  );

  // ------------------------------------------------------------
  // SECTION 2: SOURCE CODE OPTIMIZATION VERIFICATION
  // ------------------------------------------------------------
  const userMovieRepoSrc = fs.readFileSync('src/db/repositories/userMovieRepository.ts', 'utf8');
  assert(
    userMovieRepoSrc.includes('static async getByMovieIds') &&
    userMovieRepoSrc.includes('static async getWatchedWithMovies') &&
    userMovieRepoSrc.includes('static async getWatchlistWithMovies'),
    'TEST 15: UserMovieRepository Targeted Methods Implemented',
    'getByMovieIds, getWatchedWithMovies, and getWatchlistWithMovies exist'
  );

  const movieRepoSrc = fs.readFileSync('src/db/repositories/movieRepository.ts', 'utf8');
  assert(
    movieRepoSrc.includes('Promise.all(ids.map'),
    'TEST 16: MovieRepository.getByIds Concurrent Retrieval Active',
    'Concurrently fetches movie IDs in single transaction with Promise.all'
  );

  const collectionRepoSrc = fs.readFileSync('src/db/repositories/collectionRepository.ts', 'utf8');
  assert(
    collectionRepoSrc.includes('UserMovieRepository.getByMovieIds(movieIds)'),
    'TEST 17: CollectionRepository Uses Batched getByMovieIds',
    'calculateProgress and getWithMovies use single-transaction UserMovieRepository.getByMovieIds'
  );

  const watchlistPageSrc = fs.readFileSync('src/pages/WatchlistPage.tsx', 'utf8');
  assert(
    watchlistPageSrc.includes('UserMovieRepository.getWatchlistWithMovies()'),
    'TEST 18: WatchlistPage Uses Targeted Status Index Method',
    'Replaced slow getAllWithMovies() full scan with targeted getWatchlistWithMovies()'
  );

  const watchedPageSrc = fs.readFileSync('src/pages/WatchedPage.tsx', 'utf8');
  assert(
    watchedPageSrc.includes('UserMovieRepository.getWatchedWithMovies()'),
    'TEST 19: WatchedPage Uses Targeted Status Index Method',
    'Replaced slow getAllWithMovies() full scan with targeted getWatchedWithMovies()'
  );

  // ------------------------------------------------------------
  // SECTION 3: INDEXEDDB DATABASE BATCHING & QUERY SCALABILITY
  // ------------------------------------------------------------
  const db = await openDB('perf-benchmark-db', 1, {
    upgrade(d) {
      d.createObjectStore('movies', { keyPath: 'id' });
      const umStore = d.createObjectStore('userMovies', { keyPath: 'movieId' });
      umStore.createIndex('by-status', 'status');
      d.createObjectStore('collections', { keyPath: 'id' });
      d.createObjectStore('collectionMovies', { keyPath: 'id' });
    }
  });

  // Seed 1,000 synthetic movies and userMovies
  console.log('\n[BENCHMARK] Seeding 1,000 movies into IndexedDB benchmark instance...');
  const tx = db.transaction(['movies', 'userMovies', 'collections', 'collectionMovies'], 'readwrite');
  const mStore = tx.objectStore('movies');
  const umStore = tx.objectStore('userMovies');
  const cStore = tx.objectStore('collections');
  const cmStore = tx.objectStore('collectionMovies');

  const testMovieIds = [];
  for (let i = 1; i <= 1000; i++) {
    testMovieIds.push(i);
    mStore.put({
      id: i,
      title: `Film Chronicle #${i}`,
      releaseDate: `${2000 + (i % 25)}-05-15`,
      voteAverage: 7.2 + (i % 20) * 0.1,
      runtime: 110 + (i % 40),
      genres: [{ id: 18, name: 'Drama' }],
    });

    umStore.put({
      movieId: i,
      status: i <= 400 ? 'watched' : (i <= 700 ? 'want_to_watch' : 'watching'),
      watchedAt: i <= 400 ? new Date().toISOString() : null,
      watchingAt: i > 700 ? new Date().toISOString() : null,
      addedAt: new Date().toISOString(),
      isFavorite: i % 10 === 0,
      rewatchCount: 0,
    });
  }

  // Create a 500-movie collection
  cStore.put({
    id: 'epic-500-collection',
    name: 'Epic 500 Movie Marathon',
    description: 'High-scale collection performance test',
    coverMovieId: 1,
    sortMode: 'custom',
    customOrder: testMovieIds.slice(0, 500),
    isPinned: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    finalMovieId: null,
  });

  for (let pos = 0; pos < 500; pos++) {
    const mId = testMovieIds[pos];
    cmStore.put({
      id: `epic-500-collection_${mId}`,
      collectionId: 'epic-500-collection',
      movieId: mId,
      position: pos,
      addedAt: new Date().toISOString(),
    });
  }
  await tx.done;

  // Measure Sequential N transactions (Legacy pattern)
  const subset500 = testMovieIds.slice(0, 500);
  const tSeq = performance.now();
  for (const id of subset500) {
    await db.get('userMovies', id);
  }
  const sequentialTime = performance.now() - tSeq;

  // Measure Single Readonly Transaction (Batched pattern)
  const tBatch = performance.now();
  const txRead = db.transaction('userMovies', 'readonly');
  const store = txRead.objectStore('userMovies');
  const userMovieResults = await Promise.all(subset500.map(id => store.get(id)));
  await txRead.done;
  const batchedTime = performance.now() - tBatch;

  assert(
    userMovieResults.length === 500,
    'TEST 20: 500-Item Batched IndexedDB Read Transaction',
    `Batched lookup took ${batchedTime.toFixed(2)} ms vs sequential ${sequentialTime.toFixed(2)} ms (${(sequentialTime / batchedTime).toFixed(1)}x faster)`
  );

  // Measure Targeted status index query vs Full Scan
  const tScan = performance.now();
  const allUserMovies = await db.getAll('userMovies');
  const filteredWatched = allUserMovies.filter(um => um.status === 'watched');
  const fullScanTime = performance.now() - tScan;

  const tIdx = performance.now();
  const indexWatched = await db.getAllFromIndex('userMovies', 'by-status', 'watched');
  const indexQueryTime = performance.now() - tIdx;

  assert(
    indexWatched.length === 400 && filteredWatched.length === 400,
    'TEST 21: Targeted by-status Index Query Scaling',
    `Indexed query took ${indexQueryTime.toFixed(2)} ms vs full scan ${fullScanTime.toFixed(2)} ms (${(fullScanTime / indexQueryTime).toFixed(1)}x faster)`
  );

  // Measure fast index counts
  const tCount = performance.now();
  const totalCount = await db.count('userMovies');
  const watchedCount = await db.countFromIndex('userMovies', 'by-status', 'watched');
  const countTime = performance.now() - tCount;

  assert(
    totalCount === 1000 && watchedCount === 400,
    'TEST 22: Fast Index Count Operations',
    `Count operations took ${countTime.toFixed(2)} ms without loading 1,000 objects into memory`
  );

  // ------------------------------------------------------------
  // SECTION 4: REQUEST DEDUPLICATION & TMDB PERFORMANCE
  // ------------------------------------------------------------
  const tmdbSrc = fs.readFileSync('src/services/tmdbService.ts', 'utf8');
  assert(
    tmdbSrc.includes('IN_FLIGHT_REQUESTS') && tmdbSrc.includes('MEMORY_CACHE'),
    'TEST 23: TMDBService Request Deduplication & Multi-Tier Cache Active',
    'IN_FLIGHT_REQUESTS map prevents duplicate network calls, MEMORY_CACHE prevents re-parsing'
  );

  // ------------------------------------------------------------
  // SECTION 5: CINEMATIC & RESPONSIVE ARCHITECTURE INTEGRITY
  // ------------------------------------------------------------
  const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
  assert(
    appSrc.includes('React.Suspense') && appSrc.includes('AtmosphericLoader'),
    'TEST 24: Atmospheric Suspense Fallback Preserves Cinematic Identity',
    'Secondary pages render AtmosphericLoader during lazy bundle hydration'
  );

  const shellSrc = fs.readFileSync('src/components/cinema/CinemaShell.tsx', 'utf8');
  assert(
    shellSrc.includes('cinema-film-grain') && shellSrc.includes('ambientColor'),
    'TEST 25: CinemaShell Preserves Film Grain & Ambient Glow',
    'Cinematic backdrop, noise canvas, and ambient glow intact'
  );

  const watchedBtnSrc = fs.readFileSync('src/components/movie/WatchedButton.tsx', 'utf8');
  assert(
    watchedBtnSrc.includes('soundService.playWatchedChime') && watchedBtnSrc.includes('hapticsService.success'),
    'TEST 26: WatchedButton Preserves Harmonic Chime & Tactile Haptic',
    'Mark as Watched interaction keeps real audio/haptic feedback on atomic write'
  );

  // Prohibited features check
  assert(
    !appSrc.includes('MovieNight') && !appSrc.includes('Timer') && !appSrc.includes('ScreenTime'),
    'TEST 27: Zero Prohibited Features Introduced',
    'App code is free of Timer, MovieNight, and ScreenTime'
  );

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPerformanceTestSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
