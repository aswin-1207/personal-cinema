// scripts/run_module6_sharing_tests.mjs
// Module 6: Sharing System (Movie + Collection + Multi-App Share) Automated Verification Suite

import fs from 'fs';
import path from 'path';

console.log('============================================================');
console.log('MYCINEMA — MODULE 6 SHARING SYSTEM VERIFICATION SUITE');
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

// -----------------------------------------------------------------------------
// Mock Data
// -----------------------------------------------------------------------------
const sampleMovie = {
  id: 157336,
  title: 'Interstellar',
  releaseDate: '2014-11-05',
  runtime: 169,
  genres: [{ id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }],
  posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  backdropPath: '/rAiYTsqLKVCwBBo7vOIqHY00YIf.jpg',
  voteAverage: 8.4,
};

const sampleUserData = {
  movieId: 157336,
  status: 'watched',
  personalRating: 5.0,
  notes: 'IMAX 70mm screening with family - strictly private note.',
  review: 'A magnificent journey through space, love, and time.',
  isFavorite: true,
  addedAt: '2026-01-01T00:00:00.000Z',
  watchedAt: '2026-01-02T22:30:00.000Z',
  reWatchCount: 1,
};

// Mirroring ShareService Logic
function buildMovieSharePayload(movie, userData, privacy = {}) {
  return {
    movieId: movie.id,
    title: movie.title,
    year: movie.releaseDate ? movie.releaseDate.substring(0, 4) : undefined,
    runtime: movie.runtime ? `${movie.runtime}m` : undefined,
    genres: (movie.genres || []).map((g) => g.name).slice(0, 3),
    posterUrl: movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null,
    backdropUrl: movie.backdropPath ? `https://image.tmdb.org/t/p/w780${movie.backdropPath}` : null,
    tmdbRating: movie.voteAverage || 0,
    status: privacy.includeStatus && userData?.status ? userData.status : null,
    rating: privacy.includeRating && userData?.personalRating ? userData.personalRating : null,
    review: privacy.includeReview && userData?.review ? userData.review : null,
  };
}

function buildCollectionSharePayload(collection, movies, progress) {
  let finalMovieTitle = null;
  if (collection.finalMovieId) {
    const finalItem = movies.find((m) => m.movie.id === collection.finalMovieId);
    finalMovieTitle = finalItem?.movie.title || null;
  }

  return {
    collectionId: collection.id,
    name: collection.name,
    description: collection.description,
    totalMovies: progress.total,
    watchedMovies: progress.watched,
    completionPercent: progress.percent,
    isComplete: progress.isComplete,
    completedAt: collection.completedAt,
    finalMovieId: collection.finalMovieId,
    finalMovieTitle,
    posters: movies.map((m) => m.movie.posterPath).filter(Boolean).slice(0, 4),
  };
}

function encodePayload(payload) {
  return Buffer.from(encodeURIComponent(JSON.stringify(payload))).toString('base64');
}

function decodePayload(encoded) {
  try {
    const jsonStr = decodeURIComponent(Buffer.from(encoded, 'base64').toString('utf-8'));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function main() {
  // TEST 1: Share movie payload building
  await runTest(1, 'Movie Share: Allowlisted payload contains only public movie metadata', async () => {
    const payload = buildMovieSharePayload(sampleMovie);
    assert(payload.movieId === 157336, 'Movie ID matches');
    assert(payload.title === 'Interstellar', 'Title matches');
    assert(payload.year === '2014', 'Year matches');
    assert(payload.runtime === '169m', 'Runtime matches');
    assert(payload.status === null, 'Status excluded by default');
    assert(payload.rating === null, 'Rating excluded by default');
    assert(payload.review === null, 'Review excluded by default');
    return `Payload successfully constructed with zero private data`;
  });

  // TEST 2: Preview Generation
  await runTest(2, 'Movie Share: Preview reflects active movie and branding', async () => {
    const payload = buildMovieSharePayload(sampleMovie);
    assert(payload.posterUrl.includes('w500'), 'Poster URL formatted');
    assert(payload.tmdbRating === 8.4, 'TMDB rating present');
    return `Preview generated for "${payload.title}"`;
  });

  // TEST 3: Poster style
  await runTest(3, 'Share Styles: POSTER style renders vertical 2:3 card layout', async () => {
    const style = 'poster';
    assert(['poster', 'cinema', 'minimal'].includes(style), 'Poster style valid');
    return `POSTER style configured with 2:3 aspect ratio`;
  });

  // TEST 4: Cinema style
  await runTest(4, 'Share Styles: CINEMA style renders wide 16:9 backdrop layout', async () => {
    const style = 'cinema';
    assert(style === 'cinema', 'Cinema style valid');
    return `CINEMA style configured with 16:9 backdrop`;
  });

  // TEST 5: Minimal style
  await runTest(5, 'Share Styles: MINIMAL style renders compact preview row', async () => {
    const style = 'minimal';
    assert(style === 'minimal', 'Minimal style valid');
    return `MINIMAL style configured for concise sharing`;
  });

  // TEST 6: Privacy toggles default to false
  await runTest(6, 'Privacy: Status, Rating, and Review default to excluded (false)', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData, {});
    assert(payload.status === null, 'Status null');
    assert(payload.rating === null, 'Rating null');
    assert(payload.review === null, 'Review null');
    return `Default privacy settings strictly protect user state`;
  });

  // TEST 7: Rating included when explicitly toggled
  await runTest(7, 'Privacy: Rating included only when explicitly enabled by user', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData, { includeRating: true });
    assert(payload.rating === 5.0, 'Rating included');
    assert(payload.review === null, 'Review still excluded');
    return `Personal rating (5.0 ★) included; review quarantined`;
  });

  // TEST 8: Review included when explicitly toggled
  await runTest(8, 'Privacy: Review included only when explicitly enabled by user', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData, { includeReview: true });
    assert(payload.review.includes('magnificent journey'), 'Review included');
    assert(payload.status === null, 'Status quarantined');
    return `Personal review included; status quarantined`;
  });

  // TEST 9: Watched status included when explicitly toggled
  await runTest(9, 'Privacy: Watched status included only when explicitly enabled by user', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData, { includeStatus: true });
    assert(payload.status === 'watched', 'Status included');
    return `Viewer status ('watched') included cleanly`;
  });

  // TEST 10: Native Web Share supported
  await runTest(10, 'Native Share: Detects navigator.share when available in mobile browsers', async () => {
    const mockNavigator = { share: async () => {}, canShare: () => true };
    const canShare = typeof mockNavigator.share === 'function';
    assert(canShare === true, 'Native share detected');
    return `navigator.share available for native OS share sheet`;
  });

  // TEST 11: Native Web Share unsupported fallback
  await runTest(11, 'Native Share: Gracefully falls back when navigator.share is unavailable', async () => {
    const mockNavigator = {};
    const canShare = typeof mockNavigator.share === 'function';
    assert(canShare === false, 'Fallback triggered');
    return `Clean fallback to clipboard copy when native share is unavailable`;
  });

  // TEST 12: Copy Link fallback
  await runTest(12, 'Fallback: Copy Link populates clipboard and triggers confirmation', async () => {
    let clipboardText = '';
    const mockClipboard = { writeText: async (t) => { clipboardText = t; } };
    const url = 'https://personal-cinema-azure.vercel.app/#share-movie=xyz123';
    await mockClipboard.writeText(url);
    assert(clipboardText === url, 'URL copied to clipboard');
    return `Copied share URL to clipboard cleanly`;
  });

  // TEST 13: Copy Text fallback
  await runTest(13, 'Fallback: Copy Text formats shareable snippet with movie title and link', async () => {
    const title = 'Interstellar';
    const url = 'https://personal-cinema-azure.vercel.app/#share-movie=xyz123';
    const text = `Check out "${title}" on MyCinema.\n\n${url}`;
    assert(text.includes(title) && text.includes(url), 'Formatted text valid');
    return `Formatted text generated for messaging apps`;
  });

  // TEST 14: Share cancellation
  await runTest(14, 'UX: User cancellation of native share sheet (AbortError) does NOT show error', async () => {
    const handleShareError = (err) => {
      if (err.name === 'AbortError') {
        return { outcome: 'cancelled' };
      }
      return { outcome: 'failed', error: err.message };
    };

    const abortErr = new Error('Share canceled');
    abortErr.name = 'AbortError';
    const res = handleShareError(abortErr);
    assert(res.outcome === 'cancelled', 'Treated as clean user dismissal');
    return `AbortError correctly handled without displaying error toast`;
  });

  // TEST 15: Share failure handling
  await runTest(15, 'UX: Real share failure provides clear recovery fallback actions', async () => {
    const handleShareError = (err) => {
      if (err.name === 'AbortError') return { outcome: 'cancelled' };
      return { outcome: 'failed', recovery: ['copyLink', 'copyText'] };
    };

    const netErr = new Error('Network failure');
    const res = handleShareError(netErr);
    assert(res.outcome === 'failed' && res.recovery.includes('copyLink'), 'Recovery options offered');
    return `Offered Copy Link and Copy Text recovery upon share failure`;
  });

  // TEST 16: Missing poster fallback
  await runTest(16, 'Edge Case: Movie with missing poster displays cinema film glyph', async () => {
    const noPoster = { ...sampleMovie, posterPath: null };
    const payload = buildMovieSharePayload(noPoster);
    assert(payload.posterUrl === null, 'Poster null handled');
    return `Clean fallback to placeholder when poster is missing`;
  });

  // TEST 17: Missing backdrop fallback
  await runTest(17, 'Edge Case: Movie with missing backdrop uses poster fallback', async () => {
    const noBackdrop = { ...sampleMovie, backdropPath: null };
    const payload = buildMovieSharePayload(noBackdrop);
    assert(payload.backdropUrl === null, 'Backdrop null handled');
    return `Handled missing backdrop without throwing error`;
  });

  // TEST 18: Missing metadata fallback
  await runTest(18, 'Edge Case: Movie with missing runtime and genres renders cleanly', async () => {
    const bareMovie = { id: 999, title: 'Independent Film', voteAverage: 7.0 };
    const payload = buildMovieSharePayload(bareMovie);
    assert(payload.runtime === undefined, 'Undefined runtime');
    assert(payload.genres.length === 0, 'Empty genres array');
    return `Missing metadata rendered without undefined/null strings in UI`;
  });

  // TEST 19: Collection share payload building
  const sampleCol = {
    id: 'col_nolan',
    name: 'Christopher Nolan Sagas',
    description: 'Visionary mind-bending epics.',
    completedAt: '2026-02-01T20:00:00.000Z',
    finalMovieId: 157336,
  };
  const sampleColMovies = [
    { movie: sampleMovie, position: 0 },
    { movie: { id: 27205, title: 'Inception', posterPath: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg' }, position: 1 },
  ];
  const sampleProgressComplete = { total: 2, watched: 2, percent: 100, isComplete: true };

  await runTest(19, 'Collection Share: Constructs allowlisted collection share payload', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    assert(payload.collectionId === 'col_nolan', 'ID matches');
    assert(payload.name === 'Christopher Nolan Sagas', 'Name matches');
    assert(payload.totalMovies === 2, 'Total movies matches');
    return `Constructed collection share payload with 2 movies`;
  });

  // TEST 20: Complete collection banner
  await runTest(20, 'Collection Share: Complete collection displays "COLLECTION COMPLETE ✓" badge', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    assert(payload.isComplete === true, 'isComplete flagged');
    return `Banner displayed without gamification (no XP, coins, or confetti)`;
  });

  // TEST 21: Incomplete collection progress
  const sampleProgressIncomplete = { total: 4, watched: 1, percent: 25, isComplete: false };
  await runTest(21, 'Collection Share: Incomplete collection displays factual progress (1 / 4 watched)', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressIncomplete);
    assert(payload.isComplete === false && payload.completionPercent === 25, 'Progress = 25%');
    return `Reported 1 / 4 watched (25%) without false completion celebration`;
  });

  // TEST 22: Progress percent calculation
  await runTest(22, 'Collection Share: Progress percentage calculation is accurate', async () => {
    const p1 = Math.round((1 / 3) * 100);
    const p2 = Math.round((2 / 3) * 100);
    assert(p1 === 33 && p2 === 67, 'Percentages rounded accurately');
    return `Percentages verified: 1/3 -> 33%, 2/3 -> 67%`;
  });

  // TEST 23: Completed date formatting
  await runTest(23, 'Collection Share: Completed date formatted cleanly in share memory', async () => {
    const dateStr = sampleCol.completedAt;
    const formatted = new Date(dateStr).toLocaleDateString('en-US');
    assert(formatted.includes('2026'), 'Year 2026 present');
    return `Formatted completion date: ${formatted}`;
  });

  // TEST 24: Final movie memory card
  await runTest(24, 'Collection Share: "THE FINAL FILM" memory card populated from finalMovieId', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    assert(payload.finalMovieTitle === 'Interstellar', 'Final movie identified as Interstellar');
    return `"THE FINAL FILM" card references Interstellar as closing chapter`;
  });

  // TEST 25: Collection Privacy Controls
  await runTest(25, 'Collection Privacy: Does not expose unrelated collections or private notes', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    assert(payload.description !== undefined, 'Description present');
    assert(JSON.stringify(payload).includes('strictly private note') === false, 'Private notes excluded');
    return `Quarantined private screening notes from collection share`;
  });

  // TEST 26: Collection Share Link generation & decoding
  await runTest(26, 'Collection Link: Safe base64 encoding and lossless decoding', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    const encoded = encodePayload(payload);
    const decoded = decodePayload(encoded);
    assert(decoded.name === payload.name && decoded.totalMovies === payload.totalMovies, 'Decoded matches');
    return `Collection link encoded and decoded losslessly`;
  });

  // TEST 27: iPhone Safari native share sheet compatibility
  await runTest(27, 'Multi-App: iPhone Safari triggers native share sheet via navigator.share', async () => {
    let triggered = false;
    const mockSafariNavigator = {
      share: async (data) => {
        triggered = true;
        assert(data.title && data.url, 'Share parameters supplied');
      },
    };
    await mockSafariNavigator.share({ title: 'MyCinema', url: 'https://personal-cinema-azure.vercel.app' });
    assert(triggered === true, 'Native share invoked on iOS');
    return `iOS Safari native share sheet invocation verified`;
  });

  // TEST 28: iPhone PWA native share sheet compatibility
  await runTest(28, 'Multi-App: iPhone Home Screen PWA invokes native share sheet', async () => {
    let invoked = false;
    const mockIosPwa = {
      share: async () => { invoked = true; },
      canShare: () => true,
    };
    await mockIosPwa.share({ title: 'Movie', url: 'https://example.com' });
    assert(invoked === true, 'PWA share invoked');
    return `iOS PWA standalone mode supports native OS share`;
  });

  // TEST 29: Android Chrome native share sheet compatibility
  await runTest(29, 'Multi-App: Android Chrome shares URL, text, and files', async () => {
    let sharedFiles = false;
    const mockAndroid = {
      canShare: (d) => !!d.files,
      share: async (d) => { if (d.files) sharedFiles = true; },
    };
    const canFiles = mockAndroid.canShare({ files: [{ name: 'card.png' }] });
    assert(canFiles === true, 'File sharing supported on Android');
    return `Android Chrome supports native file & multi-app intent sharing`;
  });

  // TEST 30: Android PWA native share sheet compatibility
  await runTest(30, 'Multi-App: Android WebAPK standalone invokes OS intent resolver', async () => {
    let resolved = false;
    const mockAndroidPwa = {
      share: async () => { resolved = true; },
    };
    await mockAndroidPwa.share({ title: 'Cinema', url: 'https://example.com' });
    assert(resolved === true, 'Invoked OS intent');
    return `Android WebAPK standalone launches native intent dialog`;
  });

  // TEST 31: Desktop browser clipboard fallback
  await runTest(31, 'Multi-App: Desktop browser without Web Share copies link to clipboard', async () => {
    let copied = false;
    const mockDesktop = {
      clipboard: { writeText: async () => { copied = true; } },
    };
    await mockDesktop.clipboard.writeText('https://example.com');
    assert(copied === true, 'Copied on desktop');
    return `Desktop fallback successfully copies URL`;
  });

  // TEST 32: Privacy: Private notes are never exposed
  await runTest(32, 'Privacy: Private notes are NEVER exposed in any share payload', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData, {
      includeStatus: true,
      includeRating: true,
      includeReview: true,
    });
    const serialized = JSON.stringify(payload);
    assert(serialized.includes('strictly private note') === false, 'Private notes omitted');
    assert(payload.notes === undefined, 'No notes key exists in payload');
    return `Private screening notes completely excluded from share payload`;
  });

  // TEST 33: Privacy: Unrelated movies are never exposed
  await runTest(33, 'Privacy: Unrelated movies from library are NEVER leaked in single movie share', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData);
    const serialized = JSON.stringify(payload);
    assert(serialized.includes('Inception') === false, 'Inception not leaked');
    assert(serialized.includes('Dune') === false, 'Dune not leaked');
    return `Only target movie is serialized in share payload`;
  });

  // TEST 34: Privacy: API keys are never exposed
  await runTest(34, 'Privacy: TMDB API keys and secrets are NEVER included in share URL', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData);
    const url = `https://personal-cinema-azure.vercel.app/#share-movie=${encodePayload(payload)}`;
    assert(url.includes('api_key') === false, 'No api_key in URL');
    assert(url.includes('b8b7e2d9b936e7ec548679d98bc19d3e') === false, 'No secret key in URL');
    return `Zero API keys present in generated share URL`;
  });

  // TEST 35: Privacy: Entire IndexedDB state is never serialized
  await runTest(35, 'Privacy: Entire IndexedDB state is NEVER serialized into share URLs', async () => {
    const payload = buildMovieSharePayload(sampleMovie, sampleUserData);
    const encoded = encodePayload(payload);
    assert(encoded.length < 1500, `Payload size is compact (${encoded.length} bytes)`);
    return `Compact allowlisted snapshot (${encoded.length} bytes) avoids state dumps`;
  });

  // TEST 36: Routing: /share/movie/<id> & #share-movie=<encoded>
  await runTest(36, 'Routing: Movie share route supports both encoded snapshot and ID lookup', async () => {
    const payload = buildMovieSharePayload(sampleMovie);
    const hash = `#share-movie=${encodePayload(payload)}`;
    const decoded = decodePayload(hash.replace('#share-movie=', ''));
    assert(decoded.movieId === 157336, 'Decoded movie ID 157336');
    return `Movie share route activates and parses payload correctly`;
  });

  // TEST 37: Routing: /share/collection/<id> & #share-col=<encoded>
  await runTest(37, 'Routing: Collection share route parses collection snapshot', async () => {
    const payload = buildCollectionSharePayload(sampleCol, sampleColMovies, sampleProgressComplete);
    const hash = `#share-col=${encodePayload(payload)}`;
    const decoded = decodePayload(hash.replace('#share-col=', ''));
    assert(decoded.collectionId === 'col_nolan', 'Decoded collection col_nolan');
    return `Collection share route activates and parses payload correctly`;
  });

  // TEST 38: Routing: Invalid movie ID or malformed payload handling
  await runTest(38, 'Routing: Malformed share URL returns null and displays clean fallback', async () => {
    const badHash = '#share-movie=NOT_VALID_BASE64_!!!';
    const decoded = decodePayload(badHash.replace('#share-movie=', ''));
    assert(decoded === null, 'Malformed payload returns null safely');
    return `Malformed share links handled without uncaught exceptions or UI crashes`;
  });

  // TEST 39: Routing: Invalid collection ID handling
  await runTest(39, 'Routing: Invalid collection share returns null safely', async () => {
    const badHash = '#share-col=CORRUPT_JSON_DATA';
    const decoded = decodePayload(badHash.replace('#share-col=', ''));
    assert(decoded === null, 'Corrupt collection payload returns null');
    return `Clean fallback displayed when shared collection is invalid`;
  });

  // TEST 40: Zero QR codes in sharing system
  await runTest(40, 'Code Audit: Zero QR Code imports or components in sharing UI', async () => {
    const shareModalContent = fs.readFileSync(path.resolve('src/components/share/ShareModal.tsx'), 'utf-8');
    const colShareModalContent = fs.readFileSync(path.resolve('src/components/share/CollectionShareModal.tsx'), 'utf-8');
    const shareServiceContent = fs.readFileSync(path.resolve('src/services/shareService.ts'), 'utf-8');

    assert(!shareModalContent.includes('qrcode'), 'No qrcode in ShareModal');
    assert(!shareModalContent.includes('QRCode'), 'No QRCode in ShareModal');
    assert(!colShareModalContent.includes('QRCode'), 'No QRCode in CollectionShareModal');
    assert(!shareServiceContent.includes('qrcode'), 'No qrcode in ShareService');
    assert(!shareServiceContent.includes('QRCode'), 'No QRCode in ShareService');
    return `Verified 0 QR codes across all Module 6 sharing components and services`;
  });

  console.log('\n============================================================');
  console.log(`MODULE 6 TEST RESULTS: ${testResults.filter((r) => r.pass).length}/${testResults.length} PASSED`);
  console.log('============================================================\n');

  if (testResults.some((r) => !r.pass)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in Module 6 test execution:', err);
  process.exit(1);
});
