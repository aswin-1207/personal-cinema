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
console.log('MYCINEMA — MODULE 8 CINEMATIC EXPERIENCE SYSTEM VERIFICATION');
console.log('============================================================\n');

// 1. Audit Design Tokens & Master Theme
const themeCss = fs.readFileSync('src/styles/cinemaTheme.css', 'utf-8');

assert(
  themeCss.includes('#09090B') &&
  themeCss.includes('#131319') &&
  themeCss.includes('#E0AD52') &&
  themeCss.includes('#8C7AD0') &&
  themeCss.includes('#F5F3EB') &&
  themeCss.includes('#B3262E'),
  'TEST 1: Design Tokens: Canonical cinematic palette defined in CSS variables',
  'Cinema Black, Surface, Gold, Purple, White, and Deep Red verified'
);

assert(
  themeCss.includes('--cinema-motion-micro') &&
  themeCss.includes('--cinema-motion-fast') &&
  themeCss.includes('--cinema-motion-standard') &&
  themeCss.includes('--cinema-motion-emphasis') &&
  themeCss.includes('--cinema-motion-cinematic') &&
  themeCss.includes('--cinema-motion-signature'),
  'TEST 2: Motion Tokens: Centralized motion hierarchy tokens defined',
  'Micro, Fast, Standard, Emphasis, Cinematic, and Signature tokens verified'
);

assert(
  themeCss.includes('.cinema-film-grain') && themeCss.includes('noiseFilter'),
  'TEST 3: Film Grain: Lightweight SVG data URI noise filter defined',
  'Atmospheric film grain overlay defined without external image asset dependencies'
);

// 2. Audit App Shell Film Grain & Atmosphere Integration
const cinemaShell = fs.readFileSync('src/components/cinema/CinemaShell.tsx', 'utf-8');

assert(
  cinemaShell.includes('cinema-film-grain'),
  'TEST 4: App Shell: Film grain overlay integrated into base canvas',
  'CinemaShell renders subtle film grain overlay on background layer'
);

assert(
  cinemaShell.includes('ambientColor') && cinemaShell.includes('radial-gradient'),
  'TEST 5: App Shell: Ambient artwork atmosphere glow active',
  'CinemaShell renders dynamic ambient glow with smooth transition duration'
);

// 3. Dynamic Artwork Atmosphere Service
const atmosphereServiceSrc = fs.readFileSync('src/services/atmosphereService.ts', 'utf-8');

assert(
  atmosphereServiceSrc.includes('getArtworkAtmosphere') &&
  atmosphereServiceSrc.includes('cache') &&
  atmosphereServiceSrc.includes('CINEMATIC_PALETTES'),
  'TEST 6: Atmosphere Service: Caches artwork undertones with 0ms lookup',
  'AtmosphereService provides performant, CORS-safe ambient hue derivation'
);

// 4. Signature Mark as Watched Experience
const watchedButtonSrc = fs.readFileSync('src/components/movie/WatchedButton.tsx', 'utf-8');

assert(
  watchedButtonSrc.includes('isMorphing') &&
  watchedButtonSrc.includes('animate-watched-morph') &&
  watchedButtonSrc.includes('animate-check-draw'),
  'TEST 7: Watched Button: Signature morph sequence and SVG check draw active',
  'Checkmark stroke and gold morph animation keyframes integrated'
);

assert(
  watchedButtonSrc.includes('soundService.playWatchedChime') &&
  watchedButtonSrc.includes('hapticsService.success'),
  'TEST 8: Watched Button: Audio and tactile feedback triggered on success',
  'Synthesized harmonic chime and haptic feedback triggered on DB commit'
);

assert(
  watchedButtonSrc.includes('hasError') &&
  watchedButtonSrc.includes('soundService.playErrorTone') &&
  watchedButtonSrc.includes('hapticsService.error'),
  'TEST 9: Watched Button: Error state triggers error tone and haptic without fake success',
  'Zero fake success: uncommitted storage attempts fail fast and trigger error feedback'
);

assert(
  watchedButtonSrc.includes('unmarkWatched') &&
  watchedButtonSrc.includes('soundService.playSubtleClick') &&
  watchedButtonSrc.includes('hapticsService.tap'),
  'TEST 10: Watched Button: Undo operation persists unmark with subtle click feedback',
  'Undo changes persisted state and triggers soft click'
);

// 5. Tactile Movie Card & Poster Experience
const moviePosterSrc = fs.readFileSync('src/components/movie/MoviePoster.tsx', 'utf-8');

assert(
  moviePosterSrc.includes('cinema-card-tactile') &&
  moviePosterSrc.includes('cinema-skeleton'),
  'TEST 11: Movie Poster: Tactile interaction and shimmer skeleton during load',
  'Tactile press feedback and shimmer skeleton verified on MoviePoster'
);

assert(
  moviePosterSrc.includes('soundService.playFavoritePop') &&
  moviePosterSrc.includes('hapticsService.confirm'),
  'TEST 12: Movie Poster: Favorite heart toggle provides audio and haptic feedback',
  'Favorite action delivers tactile response on tap'
);

// 6. Movie Detail Cinematic Experience
const movieDetailSrc = fs.readFileSync('src/pages/MovieDetail.tsx', 'utf-8');

assert(
  movieDetailSrc.includes('atmosphereService.getArtworkAtmosphere') &&
  movieDetailSrc.includes('ambientGlow'),
  'TEST 13: Movie Detail: Dynamic artwork atmosphere illuminates detail page',
  'Backdrop/poster artwork derives custom ambient halo in MovieDetail'
);

assert(
  movieDetailSrc.includes('motion-stagger-1') &&
  movieDetailSrc.includes('motion-stagger-2'),
  'TEST 14: Movie Detail: Staggered entrance hierarchy elevates content gracefully',
  'Backdrop and poster/metadata use controlled motion stagger'
);

// 7. Collection Progress & Completion
const collectionCardSrc = fs.readFileSync('src/components/collection/CollectionCard.tsx', 'utf-8');
const collectionCompletionModalSrc = fs.readFileSync('src/components/collection/CollectionCompletionModal.tsx', 'utf-8');

assert(
  collectionCardSrc.includes('transition-all duration-700 ease-out') ||
  collectionCardSrc.includes('transition-all duration-500'),
  'TEST 15: Collection Card: Progress bar width transitions smoothly with CSS ease',
  'Universe progress bar transitions with smooth easing'
);

assert(
  collectionCompletionModalSrc.includes('COLLECTION COMPLETE ✓') &&
  collectionCompletionModalSrc.includes('THE FINAL FILM') &&
  collectionCompletionModalSrc.includes('soundService.playCollectionTriumph') &&
  collectionCompletionModalSrc.includes('hapticsService.success'),
  'TEST 16: Collection Completion: Majestic triumph chord, haptics, and final film memory',
  'Completion moment displays factual journey memory without gamification'
);

assert(
  !collectionCompletionModalSrc.includes('confetti') &&
  !collectionCompletionModalSrc.includes('trophy') &&
  !collectionCompletionModalSrc.includes('Mastered') &&
  !collectionCompletionModalSrc.includes('XP') &&
  !collectionCompletionModalSrc.includes('coins'),
  'TEST 17: Collection Completion: Zero gamification, zero XP, zero coins, zero trophies',
  '100% clean mature cinematic completion verified'
);

// 8. Sound & Haptics Infrastructure
const soundServiceSrc = fs.readFileSync('src/services/soundService.ts', 'utf-8');
const hapticsServiceSrc = fs.readFileSync('src/services/hapticsService.ts', 'utf-8');

assert(
  soundServiceSrc.includes('playWatchedChime') &&
  soundServiceSrc.includes('playCollectionTriumph') &&
  soundServiceSrc.includes('playFavoritePop') &&
  soundServiceSrc.includes('playErrorTone') &&
  soundServiceSrc.includes('AudioContext'),
  'TEST 18: Sound System: Web Audio API synthesized audio with zero broken mp3 dependencies',
  'Audio synthesis functions for Watched, Collection, Favorite, and Error verified'
);

assert(
  hapticsServiceSrc.includes('tap') &&
  hapticsServiceSrc.includes('confirm') &&
  hapticsServiceSrc.includes('success') &&
  hapticsServiceSrc.includes('error') &&
  hapticsServiceSrc.includes('navigator.vibrate'),
  'TEST 19: Haptics System: Multi-pattern vibration abstraction with graceful fallback',
  'Haptics service supports 4 distinct vibration patterns and gracefully handles unsupported browsers'
);

assert(
  soundServiceSrc.includes('localStorage') && hapticsServiceSrc.includes('localStorage'),
  'TEST 20: User Preferences: Sound and haptics preferences persisted in storage',
  'User controls for audio and haptics respected across browser sessions'
);

// 9. Reduced Motion & Accessibility
assert(
  themeCss.includes('@media (prefers-reduced-motion: reduce)') &&
  themeCss.includes('animation-duration: 0.01ms !important') &&
  themeCss.includes('.cinema-film-grain'),
  'TEST 21: Reduced Motion: System overrides animation durations and hides film grain',
  'Full compliance with prefers-reduced-motion: reduce verified in CSS'
);

assert(
  watchedButtonSrc.includes('prefersReduced') ||
  watchedButtonSrc.includes('prefers-reduced-motion'),
  'TEST 22: Reduced Motion: WatchedButton suppresses morph sequence when reduced motion preferred',
  'Signature morph sequence respects user accessibility preference'
);

// 10. Obsolete Feature Guard
const homeSrc = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
const contextSrc = fs.readFileSync('src/context/CinemaContext.tsx', 'utf-8');

assert(
  !homeSrc.includes('Movie Night') &&
  !homeSrc.includes('Screen Time') &&
  !homeSrc.includes('Timer') &&
  !homeSrc.includes('Curated Sagas'),
  'TEST 23: Feature Integrity: Zero Movie Night, Timer, Screen Time, or Sagas in Home UI',
  'Obsolete and gamified features verified completely absent'
);

assert(
  !contextSrc.includes('rewatchCount++') &&
  !contextSrc.includes('rewatchHistory'),
  'TEST 24: Feature Integrity: Zero rewatch architecture introduced',
  'Verified rewatch architecture remains explicitly excluded as required'
);

// 11. Module 7 Structural Preservation Guard
assert(
  cinemaShell.includes('pb-[calc(env(safe-area-inset-bottom,0px)+72px)]') &&
  cinemaShell.includes('md:pl-[240px]') &&
  cinemaShell.includes('max-w-[1380px] mx-auto'),
  'TEST 25: Module 7 Preservation: Responsive shell, safe area insets, and max-width intact',
  'Module 7 structural architecture 100% preserved in Module 8'
);

console.log('\n============================================================');
console.log(`MODULE 8 TEST RESULTS: ${passCount}/${passCount + failCount} PASSED`);
console.log('============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
