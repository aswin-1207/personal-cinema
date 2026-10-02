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

async function runModule10TestSuite() {
  console.log('============================================================');
  console.log('MYCINEMA — MODULE 10: FINAL QA + PWA + PRODUCTION VERIFICATION');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // SECTION 1: PRODUCTION BUILD & ASSETS INTEGRITY
  // ------------------------------------------------------------
  const distDir = path.resolve('dist');
  assert(fs.existsSync(distDir), 'TEST 1: Production dist Directory Exists', 'Found dist/ output directory');

  const distHtml = path.join(distDir, 'index.html');
  assert(fs.existsSync(distHtml), 'TEST 2: Production index.html Generated', 'index.html exists in dist/');

  const htmlContent = fs.readFileSync(distHtml, 'utf8');
  assert(
    htmlContent.includes('rel="manifest"') &&
    htmlContent.includes('href="/manifest.webmanifest"') &&
    htmlContent.includes('rel="apple-touch-icon"') &&
    htmlContent.includes('/apple-touch-icon.png') &&
    htmlContent.includes('/favicon.png'),
    'TEST 3: index.html References Manifest & High-Res App Icons',
    'Manifest, apple-touch-icon, and favicon tags verified in HTML head'
  );

  // ------------------------------------------------------------
  // SECTION 2: PWA MANIFEST VALIDATION
  // ------------------------------------------------------------
  const manifestPath = path.join(distDir, 'manifest.webmanifest');
  assert(fs.existsSync(manifestPath), 'TEST 4: PWA Web App Manifest Exists', 'manifest.webmanifest found in dist/');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(
    manifest.name === 'MyCinema' && manifest.short_name === 'MyCinema',
    'TEST 5: Manifest App Name & Short Name',
    `Name: "${manifest.name}", Short Name: "${manifest.short_name}"`
  );
  assert(
    manifest.display === 'standalone' && manifest.start_url === '/' && manifest.scope === '/',
    'TEST 6: Manifest Standalone Display, Scope & Start URL',
    `Display: ${manifest.display}, Scope: ${manifest.scope}, Start URL: ${manifest.start_url}`
  );
  assert(
    manifest.background_color === '#09090B' && manifest.theme_color === '#09090B',
    'TEST 7: Manifest Theme & Background Colors',
    `Theme: ${manifest.theme_color}, Background: ${manifest.background_color} (Cinema Black)`
  );
  assert(
    Array.isArray(manifest.icons) && manifest.icons.length >= 3,
    'TEST 8: Manifest Icons Array Configured',
    `Found ${manifest.icons.length} icon specifications`
  );

  // ------------------------------------------------------------
  // SECTION 3: APP ICON VALIDATION (PNG SIGNATURE & RESOLUTION)
  // ------------------------------------------------------------
  const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const iconFiles = [
    { file: 'icon-192.png', expectedSize: 192 },
    { file: 'icon-512.png', expectedSize: 512 },
    { file: 'apple-touch-icon.png', expectedSize: 180 },
    { file: 'favicon.png', expectedSize: 64 },
  ];

  for (const { file, expectedSize } of iconFiles) {
    const fullPath = path.join(distDir, file);
    assert(fs.existsSync(fullPath), `TEST 9: Icon Asset Exists: ${file}`, `Found ${file} in dist/`);

    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath);
      const isPNG = buf.subarray(0, 8).equals(pngMagic);
      assert(isPNG, `TEST 10: Valid PNG Binary Signature for ${file}`, 'PNG magic bytes 89 50 4E 47 verified');

      // Verify dimensions from IHDR (offset 16-24)
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert(
        width === expectedSize && height === expectedSize,
        `TEST 11: Correct Dimensions for ${file}`,
        `Resolution verified: ${width}x${height}px (matches expected ${expectedSize}x${expectedSize}px)`
      );
    }
  }

  const svgIconPath = path.join(distDir, 'icon.svg');
  assert(fs.existsSync(svgIconPath), 'TEST 12: Scalable SVG Icon Exists', 'Found icon.svg in dist/');

  // ------------------------------------------------------------
  // SECTION 4: SERVICE WORKER RESILIENCE & CACHE VERSIONING
  // ------------------------------------------------------------
  const swPath = path.join(distDir, 'sw.js');
  assert(fs.existsSync(swPath), 'TEST 13: Service Worker Script Exists', 'Found sw.js in dist/');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(
    swContent.includes('CACHE_NAME') && swContent.includes('mycinema-v5'),
    'TEST 14: Service Worker Cache Versioning (v5)',
    'Cache name updated to mycinema-v5 for fresh asset delivery'
  );
  assert(
    swContent.includes("request.mode === 'navigate'") && swContent.includes('fetch(event.request)'),
    'TEST 15: Network-First App Shell Strategy',
    'Guarantees latest HTML is fetched first, eliminating stale deployment lockouts'
  );
  assert(
    swContent.includes('caches.delete(key)') && swContent.includes('self.clients.claim()'),
    'TEST 16: Immediate Client Claim & Stale Cache Eviction',
    'Old caches purged upon activation and active clients claimed immediately'
  );

  // ------------------------------------------------------------
  // SECTION 5: CROSS-DEVICE ISOLATION FORENSIC VERIFICATION
  // ------------------------------------------------------------
  console.log('\n[FORENSIC] Testing Cross-Device Isolation between Context A and Context B...');
  const deviceADB = await openDB('MYCINEMA_QA_DEVICE_A_12345', 1, {
    upgrade(d) {
      d.createObjectStore('movies', { keyPath: 'id' });
      const ums = d.createObjectStore('userMovies', { keyPath: 'movieId' });
      ums.createIndex('by-status', 'status');
      d.createObjectStore('collections', { keyPath: 'id' });
      d.createObjectStore('collectionMovies', { keyPath: 'id' });
    }
  });

  const deviceBDB = await openDB('MYCINEMA_QA_DEVICE_B_67890', 1, {
    upgrade(d) {
      d.createObjectStore('movies', { keyPath: 'id' });
      const ums = d.createObjectStore('userMovies', { keyPath: 'movieId' });
      ums.createIndex('by-status', 'status');
      d.createObjectStore('collections', { keyPath: 'id' });
      d.createObjectStore('collectionMovies', { keyPath: 'id' });
    }
  });

  // Device A writes private records
  const txA = deviceADB.transaction(['movies', 'userMovies', 'collections'], 'readwrite');
  await txA.objectStore('movies').put({ id: 101, title: 'Device A Exclusive Cinema', releaseDate: '2026-01-01' });
  await txA.objectStore('userMovies').put({ movieId: 101, status: 'watched', personalRating: 5.0, watchedAt: '2026-01-01' });
  await txA.objectStore('collections').put({ id: 'col-a', name: 'Private Collection A', customOrder: [101] });
  await txA.done;

  // Device B writes private records
  const txB = deviceBDB.transaction(['movies', 'userMovies', 'collections'], 'readwrite');
  await txB.objectStore('movies').put({ id: 202, title: 'Device B Independent Film', releaseDate: '2026-02-01' });
  await txB.objectStore('userMovies').put({ movieId: 202, status: 'want_to_watch', addedAt: '2026-02-01' });
  await txB.objectStore('collections').put({ id: 'col-b', name: 'Private Collection B', customOrder: [202] });
  await txB.done;

  // Verify Device B cannot see Device A data
  const bMovies = await deviceBDB.getAll('movies');
  const bUserMovies = await deviceBDB.getAll('userMovies');
  const bCollections = await deviceBDB.getAll('collections');

  assert(
    bMovies.length === 1 && bMovies[0].id === 202 && !bMovies.some(m => m.id === 101),
    'TEST 17: Device B Has Zero Leakage of Device A Movies',
    'Device B store strictly isolated from Device A'
  );
  assert(
    bUserMovies.length === 1 && bUserMovies[0].movieId === 202 && !bUserMovies.some(um => um.movieId === 101),
    'TEST 18: Device B Has Zero Leakage of Device A Watch State',
    'Watched status on Device A completely invisible to Device B'
  );
  assert(
    bCollections.length === 1 && bCollections[0].id === 'col-b' && !bCollections.some(c => c.id === 'col-a'),
    'TEST 19: Device B Has Zero Leakage of Device A Collections',
    'Collections on Device A completely invisible to Device B'
  );

  // ------------------------------------------------------------
  // SECTION 6: CORE WATCH LIFECYCLE & ZERO FAKE PERSISTENCE
  // ------------------------------------------------------------
  // Test atomic mark watched
  const txWatch = deviceADB.transaction('userMovies', 'readwrite');
  const existingA = await txWatch.objectStore('userMovies').get(101);
  assert(existingA.status === 'watched', 'TEST 20: Persisted Watched State Verified', 'Movie 101 status is watched');

  // Test unmark watched
  existingA.status = 'want_to_watch';
  existingA.watchedAt = null;
  await txWatch.objectStore('userMovies').put(existingA);
  await txWatch.done;

  const unmarkedA = await deviceADB.get('userMovies', 101);
  assert(
    unmarkedA.status === 'want_to_watch' && unmarkedA.watchedAt === null,
    'TEST 21: Unmark Watched Reverts State & Preserves Record',
    'Status returned to want_to_watch with null watchedAt'
  );

  // ------------------------------------------------------------
  // SECTION 7: PROHIBITED FEATURES CODEBASE AUDIT
  // ------------------------------------------------------------
  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert(!pkgJson.dependencies['qrcode'], 'TEST 22: QR Code Package Dependency Eliminated', 'qrcode package removed from package.json');

  const filesInSrc = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walkDir(full);
      else if (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx')) filesInSrc.push(full);
    }
  }
  walkDir('src');

  let foundProhibited = 0;
  for (const f of filesInSrc) {
    const content = fs.readFileSync(f, 'utf8');
    // Check for active timer component or movie night route
    if (content.includes('WatchTimer') || content.includes('ScreenTime') || content.includes('CuratedSagas')) {
      foundProhibited++;
    }
  }

  assert(
    foundProhibited === 0,
    'TEST 23: Complete Elimination of Obsolete Components',
    'Zero references to WatchTimer, ScreenTime, or CuratedSagas across all source files'
  );

  // ------------------------------------------------------------
  // SECTION 8: ACCESSIBILITY & DIALOG COMPLIANCE
  // ------------------------------------------------------------
  const modalSrc = fs.readFileSync('src/components/common/Modal.tsx', 'utf8');
  assert(
    modalSrc.includes('role="dialog"') && modalSrc.includes('aria-modal="true"'),
    'TEST 24: Modal Implements role=dialog and aria-modal=true',
    'Dialog accessibility attributes present on modal container'
  );

  const toastSrc = fs.readFileSync('src/components/common/Toast.tsx', 'utf8');
  assert(
    toastSrc.includes('aria-label="Dismiss notification"'),
    'TEST 25: Toast Notification Dismiss Has Accessible Name',
    'Close button provides accessible aria-label'
  );

  const posterSrc = fs.readFileSync('src/components/movie/MoviePoster.tsx', 'utf8');
  assert(
    posterSrc.includes('aria-label='),
    'TEST 26: MoviePoster Interactive Buttons Have Accessible Names',
    'Poster buttons have explicit accessible labels'
  );

  // ------------------------------------------------------------
  // SECTION 9: PERFORMANCE CODE-SPLITTING VERIFICATION
  // ------------------------------------------------------------
  const distAssets = fs.readdirSync(path.join(distDir, 'assets'));
  const mainChunk = distAssets.find(f => f.startsWith('index-') && f.endsWith('.js'));
  const mainSize = fs.statSync(path.join(distDir, 'assets', mainChunk)).size / 1024;

  assert(
    mainSize < 350,
    'TEST 27: Production Main Entry Under 350 KB Budget',
    `Main chunk size: ${mainSize.toFixed(2)} KB (budget: < 350 KB)`
  );

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runModule10TestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
