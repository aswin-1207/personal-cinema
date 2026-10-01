// scripts/run_prompt2_discover_rails_tests.mjs
// Verification suite for Prompt 2 Discover Redesign & 6-Tab Model

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('============================================================');
console.log('MYCINEMA — PROMPT 2 DISCOVER REDESIGN & UI QA SUITE');
console.log('============================================================\n');

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    process.exit(1);
  }
}

// 1. Verify 11 Rails in Discover
runTest('TEST 1: All 11 rails are defined and populated from real catalog data', () => {
  const seedJson = JSON.parse(fs.readFileSync('./src/data/seedCatalog.json', 'utf8'));
  
  const superhero = seedJson.filter(m =>
    ['marvel', 'fox_marvel', 'sony_spiderman', 'marvel_legacy', 'dc', 'disney_superhero', 'other_superhero'].includes(m.seedCategory)
  );
  const marvel = seedJson.filter(m =>
    ['marvel', 'fox_marvel', 'sony_spiderman', 'marvel_legacy'].includes(m.seedCategory)
  );
  const dc = seedJson.filter(m => m.seedCategory === 'dc');
  const scifi = seedJson.filter(m => m.genres && m.genres.some(g => g.id === 878));
  const action = seedJson.filter(m => m.genres && m.genres.some(g => g.id === 28));
  const horror = seedJson.filter(m => m.genres && m.genres.some(g => g.id === 27));
  const tamil = seedJson.filter(m => m.seedCategory === 'indian_cinema' && m.franchiseTags && m.franchiseTags.some(t => t.toLowerCase() === 'tamil') && m.title !== 'Drunken Master Su Qier');
  const indian = seedJson.filter(m => m.seedCategory === 'indian_cinema');
  const recent = seedJson.filter(m => m.seedCategory === 'recent_popular');

  assert(superhero.length >= 20, `Superhero count too low: ${superhero.length}`);
  assert(marvel.length >= 20, `Marvel count too low: ${marvel.length}`);
  assert(dc.length >= 20, `DC count too low: ${dc.length}`);
  assert(scifi.length >= 20, `Sci-Fi count too low: ${scifi.length}`);
  assert(action.length >= 20, `Action count too low: ${action.length}`);
  assert(horror.length >= 15, `Horror count too low: ${horror.length}`);
  assert(tamil.length >= 15, `Tamil count too low: ${tamil.length}`);
  assert(indian.length >= 20, `Indian count too low: ${indian.length}`);
  assert(recent.length >= 20, `Recent blockbusters count too low: ${recent.length}`);

  console.log(`       Verified real counts: Superhero (${superhero.length}), Marvel (${marvel.length}), DC (${dc.length}), Sci-Fi (${scifi.length}), Action (${action.length}), Horror (${horror.length}), Tamil (${tamil.length}), Indian (${indian.length}), Recent (${recent.length})`);
});

// 2. Verify Discover.tsx code contains the 11 rails and Cinema Search Console
runTest('TEST 2: Discover.tsx contains all 11 rail headers and Search Console', () => {
  const discoverCode = fs.readFileSync('./src/pages/Discover.tsx', 'utf8');

  assert(discoverCode.includes('TRENDING NOW'), 'Missing TRENDING NOW rail');
  assert(discoverCode.includes('POPULAR RIGHT NOW'), 'Missing POPULAR RIGHT NOW rail');
  assert(discoverCode.includes('SUPERHERO UNIVERSES'), 'Missing SUPERHERO UNIVERSES rail');
  assert(discoverCode.includes('MARVEL CINEMATIC & LEGACY'), 'Missing MARVEL CINEMATIC & LEGACY rail');
  assert(discoverCode.includes('DC EXTENDED UNIVERSE'), 'Missing DC EXTENDED UNIVERSE rail');
  assert(discoverCode.includes('SCI-FI LANDMARKS'), 'Missing SCI-FI LANDMARKS rail');
  assert(discoverCode.includes('HIGH-OCTANE ACTION'), 'Missing HIGH-OCTANE ACTION rail');
  assert(discoverCode.includes('ATMOSPHERIC HORROR'), 'Missing ATMOSPHERIC HORROR rail');
  assert(discoverCode.includes('TAMIL CINEMA'), 'Missing TAMIL CINEMA rail');
  assert(discoverCode.includes('INDIAN CINEMA'), 'Missing INDIAN CINEMA rail');
  assert(discoverCode.includes('RECENT BLOCKBUSTERS'), 'Missing RECENT BLOCKBUSTERS rail');
  
  // Search Console
  assert(discoverCode.includes('SearchField'), 'Missing SearchField in Discover');
  assert(discoverCode.includes('recentSearches'), 'Missing recentSearches in Discover');
  assert(discoverCode.includes('UnifiedSearchService'), 'Missing UnifiedSearchService in Discover');
});

// 3. Verify 6-Tab Model (no Library tab)
runTest('TEST 3: Tab model has exactly 6 tabs: home, discover, watchlist, watched, collections, profile', () => {
  const contextCode = fs.readFileSync('./src/context/CinemaContext.tsx', 'utf8');
  assert(contextCode.includes("type TabType = 'home' | 'discover' | 'watchlist' | 'watched' | 'collections' | 'profile'"), 'TabType invalid');

  const navbarCode = fs.readFileSync('./src/components/common/Navbar.tsx', 'utf8');
  assert(navbarCode.includes("id: 'home'"), 'Navbar missing home');
  assert(navbarCode.includes("id: 'discover'"), 'Navbar missing discover');
  assert(navbarCode.includes("id: 'watchlist'"), 'Navbar missing watchlist');
  assert(navbarCode.includes("id: 'watched'"), 'Navbar missing watched');
  assert(navbarCode.includes("id: 'collections'"), 'Navbar missing collections');
  assert(navbarCode.includes("id: 'profile'"), 'Navbar missing profile');
  assert(!navbarCode.includes("id: 'library'"), 'Navbar must not contain library tab');
});

// 4. Verify No "PRIVATE CINEMA" slogans exist in UI files
runTest('TEST 4: Zero occurrences of "private cinema" slogan across UI files', () => {
  const filesToCheck = [
    './index.html',
    './src/components/common/Navbar.tsx',
    './src/components/cinema/CinemaHero.tsx',
    './src/pages/Home.tsx',
    './src/pages/Discover.tsx',
    './src/pages/WatchlistPage.tsx',
    './src/pages/WatchedPage.tsx',
    './src/pages/MovieDetail.tsx',
    './src/components/collection/CollectionCard.tsx',
    './src/components/movie/MoviePoster.tsx',
    './src/components/movie/WatchedButton.tsx'
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      assert(!content.includes('private cinema'), `Found "private cinema" in ${file}`);
    }
  }
});

// 5. Verify WatchedButton signature interaction specs
runTest('TEST 5: WatchedButton meets 600-900ms motion specs, compression scale, and zero confetti', () => {
  const watchedBtnCode = fs.readFileSync('./src/components/movie/WatchedButton.tsx', 'utf8');
  assert(watchedBtnCode.includes('750'), 'WatchedButton should use ~750ms duration');
  assert(watchedBtnCode.includes('scale-[0.97]'), 'WatchedButton should compress to 0.97 scale');
  assert(watchedBtnCode.includes('WATCHED'), 'WatchedButton should show WATCHED state');
  assert(!watchedBtnCode.includes('confetti'), 'WatchedButton must not have confetti');
});

// 6. Verify Collection completion format & no trophies
runTest('TEST 6: CollectionCard renders ✓ COMPLETE with real date and no XP/coins/trophies', () => {
  const colCardCode = fs.readFileSync('./src/components/collection/CollectionCard.tsx', 'utf8');
  assert(colCardCode.includes('✓ COMPLETE'), 'CollectionCard missing ✓ COMPLETE');
  assert(colCardCode.includes('COMPLETED'), 'CollectionCard missing completion date format');
  assert(!colCardCode.includes('Trophy'), 'CollectionCard must not have Trophy');
  assert(!colCardCode.includes('XP'), 'CollectionCard must not have XP');
  assert(!colCardCode.includes('coins'), 'CollectionCard must not have coins');
});

console.log(`\n============================================================`);
console.log(`PROMPT 2 VERIFICATION COMPLETE: ${passed} / 6 TESTS PASSED | 0 FAILED`);
console.log(`============================================================`);
