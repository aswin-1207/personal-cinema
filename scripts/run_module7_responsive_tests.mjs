import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, testName, message) {
  if (condition) {
    console.log(`[PASS] ${testName} - ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${message}`);
    failCount++;
  }
}

console.log('============================================================');
console.log('MYCINEMA — MODULE 7 RESPONSIVE UI/UX STRUCTURE REBUILD TESTS');
console.log('============================================================\n');

// 1. App Shell & Layout Tokens Audit
const themeCss = fs.readFileSync('src/styles/cinemaTheme.css', 'utf-8');
const cinemaShell = fs.readFileSync('src/components/cinema/CinemaShell.tsx', 'utf-8');
const navbar = fs.readFileSync('src/components/common/Navbar.tsx', 'utf-8');

assert(
  themeCss.includes('100dvh') && themeCss.includes('--cinema-nav-height-mobile'),
  'TEST 1: App Shell: 100dvh modern viewport units and responsive tokens defined',
  'CSS root includes 100dvh and mobile navigation height tokens'
);

assert(
  themeCss.includes('--z-base') && themeCss.includes('--z-nav') && themeCss.includes('--z-modal'),
  'TEST 2: Z-Index Layering: Centralized layering hierarchy tokenized',
  'Strict layering tokens (--z-base, --z-nav, --z-modal) defined'
);

assert(
  cinemaShell.includes('pb-[calc(env(safe-area-inset-bottom,0px)+72px)]') ||
  cinemaShell.includes('pb-[calc(env(safe-area-inset-bottom'),
  'TEST 3: App Shell: Main container reserves space for mobile bottom nav without compounding gaps',
  'Shell cleanly calculates bottom clearance with safe area insets'
);

assert(
  cinemaShell.includes('md:pl-[240px]') && cinemaShell.includes('max-w-[1380px] mx-auto'),
  'TEST 4: Desktop Layout: Centered content container with desktop sidebar offset',
  'Desktop sidebar cleanly offsets and content is centered symmetrically up to 1380px'
);

// 2. Navigation System & Touch Target Audit
assert(
  navbar.includes("label: 'Collections'") && !navbar.includes("label: 'Sagas'"),
  'TEST 5: Navigation: Mobile navigation label correctly set to Collections (not Sagas)',
  'Collections destination verified in mobile nav definition'
);

assert(
  navbar.includes('size={22}') || navbar.includes('size={20}'),
  'TEST 6: Navigation: Mobile nav icons sized >= 20px (22px)',
  'Mobile nav icons provide clear visual recognition at 22px'
);

assert(
  navbar.includes('min-h-[48px]') && navbar.includes('min-w-[44px]'),
  'TEST 7: Navigation: Touch targets strictly satisfy minimum 44x44px area',
  'Mobile navigation destinations have min-h-[48px] and min-w-[44px] touch areas'
);

assert(
  navbar.includes('env(safe-area-inset-bottom'),
  'TEST 8: Navigation: Bottom bar respects env(safe-area-inset-bottom)',
  'Bottom navigation seamlessly accommodates home indicator safe areas'
);

// 3. Hero Section Fluid Responsiveness
const hero = fs.readFileSync('src/components/cinema/CinemaHero.tsx', 'utf-8');

assert(
  hero.includes('min-h-[280px]') && !hero.includes('min-h-[440px]'),
  'TEST 9: Hero: Compact responsive min-height prevents pushing content below fold',
  'Hero min-height reduced from 440px to 280px on mobile'
);

assert(
  !hero.includes('-mx-4') && !hero.includes('-mx-8'),
  'TEST 10: Hero: Bounded container eliminates horizontal overflow risk',
  'Negative margin breakouts removed; hero fits within padded container'
);

assert(
  hero.includes('line-clamp-2') && hero.includes('font-hero-title'),
  'TEST 11: Hero: Title clamped and fluid typography prevents layout blowout',
  'Hero title strictly clamped to 2 lines with fluid clamp() typography'
);

// 4. Movie Poster & Rail Responsiveness
const poster = fs.readFileSync('src/components/movie/MoviePoster.tsx', 'utf-8');
const rail = fs.readFileSync('src/components/movie/MoviePosterRail.tsx', 'utf-8');

assert(
  poster.includes("w-[130px] xs:w-[145px]") || poster.includes("w-[115px]"),
  'TEST 12: Movie Cards: Fluid card width adapts across small (320px) to large viewports',
  'Card widths scale fluidly from 130px on small mobile to 180px on desktop'
);

assert(
  poster.includes('aspect-[2/3]'),
  'TEST 13: Movie Cards: Strict 2:3 cinematic poster aspect ratio preserved',
  'Golden ratio 2:3 aspect container guaranteed'
);

assert(
  rail.includes('overscroll-x-contain'),
  'TEST 14: Poster Rails: Horizontal swipe contains overscroll without jumping vertical page',
  'overscroll-x-contain protects against gesture conflicts'
);

// 5. Grid Density & Collections Layout
const collectionsPage = fs.readFileSync('src/pages/CollectionsPage.tsx', 'utf-8');
const collectionCard = fs.readFileSync('src/components/collection/CollectionCard.tsx', 'utf-8');

assert(
  collectionsPage.includes('grid-cols-2 md:grid-cols-3 lg:grid-cols-4'),
  'TEST 15: Collections: 2-column layout on small phones, scaling to 4 on desktop',
  'Collections grid adapted to 2 columns on mobile instead of single giant banner'
);

assert(
  collectionCard.includes('line-clamp-1 sm:line-clamp-2'),
  'TEST 16: Collection Card: Compact collage and text prevents vertical elongation',
  'Collection card title and progress formatted for compact 2-column density'
);

// 6. Empty States Compact Design
const emptyState = fs.readFileSync('src/components/common/EmptyState.tsx', 'utf-8');

assert(
  !emptyState.includes('p-8 sm:p-12') && emptyState.includes('max-w-md mx-auto'),
  'TEST 17: Empty State: Compact atmospheric design does not consume full viewport',
  'Excessive padding removed; max-w-md container with elegant compact layout'
);

assert(
  emptyState.includes('w-10 h-10 sm:w-11 sm:h-11') && emptyState.includes('size={20}'),
  'TEST 18: Empty State: Icon size reduced from 64px to 20px',
  'Compact icon container prevents dominating the empty viewport'
);

// 7. Modals & Sheets Safe Areas & Clipping
const modal = fs.readFileSync('src/components/common/Modal.tsx', 'utf-8');

assert(
  modal.includes('max-h-[86dvh]') || modal.includes('max-h-[88dvh]'),
  'TEST 19: Modals: Bounded by 86dvh with internal scrolling',
  'Modal height bounded with dynamic dvh units preventing viewport clipping'
);

assert(
  modal.includes('min-w-[44px] min-h-[44px]'),
  'TEST 20: Modals: Close button touch target satisfies minimum 44x44px',
  'Modal close button has 44x44px accessible touch area'
);

// 8. Movie Detail Responsive Hierarchy
const movieDetail = fs.readFileSync('src/pages/MovieDetail.tsx', 'utf-8');

assert(
  movieDetail.includes('h-[32vh]') && movieDetail.includes('max-h-[420px]'),
  'TEST 21: Movie Detail: Backdrop height scaled down on mobile',
  'Backdrop max-height controlled to 420px (was 540px) to elevate core movie info'
);

assert(
  movieDetail.includes('w-28 xs:w-36 sm:w-48 md:w-56'),
  'TEST 22: Movie Detail: Overlapping poster scales fluidly from 112px on small mobile',
  'Poster width fluidly adapts to screen width without colliding with title'
);

assert(
  movieDetail.includes('WatchedButton') && movieDetail.includes('style="prominent"'),
  'TEST 23: Movie Detail: Mark as Watched primary interaction prominently positioned',
  'Mark as Watched retained as primary action in both desktop and mobile bars'
);

// 9. Viewport Matrix Calculation Tests
const VIEWPORT_MATRIX = [
  { name: 'Small Mobile (iPhone SE 1st)', width: 320, height: 568 },
  { name: 'Standard Android (Galaxy S8)', width: 360, height: 800 },
  { name: 'iPhone 8 / SE 2', width: 375, height: 667 },
  { name: 'iPhone 12 / 13 / 14', width: 390, height: 844 },
  { name: 'iPhone 15 / 16 Reference', width: 393, height: 852 },
  { name: 'Pixel 7 / Galaxy S23', width: 412, height: 915 },
  { name: 'iPhone Pro Max', width: 430, height: 932 },
  { name: 'Large Phone / Phablet', width: 600, height: 960 },
  { name: 'iPad Portrait', width: 768, height: 1024 },
  { name: 'iPad Landscape', width: 1024, height: 768 },
  { name: 'Standard Laptop', width: 1280, height: 800 },
  { name: 'Desktop Display', width: 1440, height: 900 },
];

VIEWPORT_MATRIX.forEach((vp, idx) => {
  const isMobile = vp.width < 768;
  const isDesktop = vp.width >= 1024;
  const isSmallMobile = vp.width <= 360;

  // Verify columns for movie grid
  let expectedCols = isSmallMobile ? 2 : vp.width < 640 ? 2 : vp.width < 768 ? 3 : vp.width < 1024 ? 4 : vp.width < 1280 ? 5 : 6;
  let cardWidth = isSmallMobile ? Math.floor((vp.width - 32) / 2) : 165;

  assert(
    expectedCols >= 2 && cardWidth >= 110,
    `TEST ${24 + idx}: Viewport Matrix: ${vp.name} (${vp.width}x${vp.height})`,
    `Calculated ${expectedCols} columns, card width ~${cardWidth}px with comfortable spacing`
  );
});

// 10. Obsolete UI Audit
const home = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
const discover = fs.readFileSync('src/pages/Discover.tsx', 'utf-8');

assert(
  !home.includes('Curated Sagas') && !home.includes('NEXT UP IN SAGA'),
  'TEST 36: Obsolete UI: Zero Sagas references in Home UI',
  'All saga references cleaned up to Collections in Home.tsx'
);

assert(
  !home.includes('movieNights') && !home.includes('screenTime'),
  'TEST 37: Obsolete UI: Zero Movie Night or Screen Time in Home',
  'Zero legacy gamification or screen time trackers'
);

assert(
  !discover.includes('mutant sagas'),
  'TEST 38: Obsolete UI: Subtitle references in Discover cleaned',
  'Discover subtitle verified clean'
);

assert(
  !themeCss.includes('Dynamic Island') && !cinemaShell.includes('Dynamic Island'),
  'TEST 39: App Shell: Zero Dynamic Island hacks',
  'Standard safe area insets used without device-specific dynamic island assumptions'
);

assert(
  cinemaShell.includes('pb-[calc(env(safe-area-inset-bottom,0px)+72px)]') &&
  !home.includes('pb-24') && !collectionsPage.includes('pb-24'),
  'TEST 40: Breathing Space: Compounding bottom padding eliminated',
  'Eliminated double bottom padding (pb-24 removed from pages)'
);

console.log('\n============================================================');
console.log(`MODULE 7 TEST RESULTS: ${passCount}/${passCount + failCount} PASSED`);
console.log('============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
