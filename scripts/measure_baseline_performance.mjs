import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

async function measureBaseline() {
  console.log('============================================================');
  console.log('MYCINEMA — MODULE 9 BASELINE MEASUREMENTS');
  console.log('============================================================\n');

  // 1. Bundle Size Measurement
  const distDir = path.resolve('dist/assets');
  let jsFiles = [];
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    jsFiles = files.filter(f => f.endsWith('.js')).map(f => {
      const stats = fs.statSync(path.join(distDir, f));
      return { file: f, sizeKb: (stats.size / 1024).toFixed(2) };
    });
  }

  console.log('CURRENT BUNDLE ASSETS:');
  jsFiles.forEach(f => console.log(`  - ${f.file}: ${f.sizeKb} KB`));

  // 2. Database Sequential vs Batch Reads Simulation
  const db = await openDB('perf-test-db', 1, {
    upgrade(d) {
      const ms = d.createObjectStore('movies', { keyPath: 'id' });
      const ums = d.createObjectStore('userMovies', { keyPath: 'movieId' });
      ums.createIndex('by-status', 'status');
    }
  });

  // Seed 1,000 synthetic movies and userMovies
  console.log('\nSEEDING 1,000 MOVIES & USER_MOVIES...');
  const tx = db.transaction(['movies', 'userMovies'], 'readwrite');
  for (let i = 1; i <= 1000; i++) {
    tx.objectStore('movies').put({
      id: i,
      title: `Film Title #${i}`,
      voteAverage: 7.5,
      releaseDate: '2025-01-01'
    });
    tx.objectStore('userMovies').put({
      movieId: i,
      status: i % 3 === 0 ? 'watched' : (i % 3 === 1 ? 'want_to_watch' : 'watching'),
      watchedAt: i % 3 === 0 ? new Date().toISOString() : null,
      addedAt: new Date().toISOString(),
      isFavorite: i % 10 === 0
    });
  }
  await tx.done;

  // Measure Sequential N transactions (Existing pattern)
  const testIds = Array.from({ length: 500 }, (_, i) => i + 1);
  const t0 = performance.now();
  for (const id of testIds) {
    await db.get('userMovies', id);
  }
  const sequentialTime = (performance.now() - t0).toFixed(2);
  console.log(`\nBENCHMARK 1 (500 items sequential get): ${sequentialTime} ms`);

  // Measure Single Readonly Transaction (Optimized pattern)
  const t1 = performance.now();
  const txRead = db.transaction('userMovies', 'readonly');
  const store = txRead.objectStore('userMovies');
  const results = await Promise.all(testIds.map(id => store.get(id)));
  await txRead.done;
  const batchedTime = (performance.now() - t1).toFixed(2);
  console.log(`BENCHMARK 2 (500 items single batched transaction): ${batchedTime} ms`);
  console.log(`SPEEDUP: ${(parseFloat(sequentialTime) / parseFloat(batchedTime)).toFixed(1)}x faster\n`);

  // Measure Full Scan vs Targeted Index Query for Watched
  const t2 = performance.now();
  const allUserMovies = await db.getAll('userMovies');
  const filteredWatched = allUserMovies.filter(um => um.status === 'watched');
  const fullScanTime = (performance.now() - t2).toFixed(2);
  console.log(`BENCHMARK 3 (Full scan + in-memory filter): ${fullScanTime} ms (Found: ${filteredWatched.length})`);

  const t3 = performance.now();
  const indexWatched = await db.getAllFromIndex('userMovies', 'by-status', 'watched');
  const indexQueryTime = (performance.now() - t3).toFixed(2);
  console.log(`BENCHMARK 4 (Targeted by-status index query): ${indexQueryTime} ms (Found: ${indexWatched.length})`);
  console.log(`SPEEDUP: ${(parseFloat(fullScanTime) / parseFloat(indexQueryTime)).toFixed(1)}x faster\n`);
}

measureBaseline().catch(console.error);
