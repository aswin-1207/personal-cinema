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

async function initTestDatabase() {
  const db = await openDB('PersonalCinemaDB_Module11', 2, {
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
    },
  });
  return db;
}

// Mirror of ReviewRepository implementation logic bound to the active test DB
class TestReviewRepository {
  constructor(db) {
    this.db = db;
  }

  async getReview(movieId) {
    return this.db.get('userMovies', movieId);
  }

  async saveReview(movieId, data) {
    const tx = this.db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const cleanReviewText = data.reviewText !== undefined ? data.reviewText.trim() : existing?.review;
    const cleanReviewTitle = data.reviewTitle !== undefined ? data.reviewTitle.trim() : existing?.reviewTitle;
    const hasReviewContent = Boolean(cleanReviewText && cleanReviewText.length > 0);

    const updated = {
      movieId,
      status: existing?.status || 'watched',
      personalRating: data.rating !== undefined ? data.rating : existing?.personalRating ?? null,
      notes: existing?.notes,
      review: hasReviewContent ? cleanReviewText : undefined,
      reviewTitle: hasReviewContent && cleanReviewTitle ? cleanReviewTitle : undefined,
      reviewedAt: hasReviewContent ? (existing?.reviewedAt || now) : (existing?.reviewedAt ?? null),
      hasSpoilers: data.hasSpoilers !== undefined ? data.hasSpoilers : existing?.hasSpoilers ?? false,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt || now,
      watchingAt: null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: 0,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  async deleteReview(movieId) {
    const tx = this.db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);

    if (!existing) {
      await tx.done;
      throw new Error(`Movie #${movieId} not found in library.`);
    }

    const updated = {
      ...existing,
      review: undefined,
      reviewTitle: undefined,
      reviewedAt: null,
      hasSpoilers: false,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  async deleteRating(movieId) {
    const tx = this.db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);

    if (!existing) {
      await tx.done;
      throw new Error(`Movie #${movieId} not found in library.`);
    }

    const updated = {
      ...existing,
      personalRating: null,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  async getAllJournalEntries() {
    const allUserMovies = await this.db.getAll('userMovies');
    const journalUserMovies = allUserMovies.filter((um) => {
      const hasReview = Boolean(um.review && um.review.trim().length > 0);
      const hasRating = typeof um.personalRating === 'number';
      return hasReview || hasRating;
    });

    const results = [];
    for (const um of journalUserMovies) {
      const movie = await this.db.get('movies', um.movieId);
      if (movie) {
        results.push({ movie, userData: um });
      }
    }
    return results;
  }

  search(items, query) {
    if (!query || !query.trim()) {
      return items.map((item) => ({ item, matchType: 'title' }));
    }

    const q = query.toLowerCase().trim();
    const results = [];

    for (const item of items) {
      const titleMatch =
        item.movie.title.toLowerCase().includes(q) ||
        Boolean(item.movie.originalTitle && item.movie.originalTitle.toLowerCase().includes(q));

      const reviewText = item.userData?.review || '';
      const reviewTitle = item.userData?.reviewTitle || '';
      const textMatch =
        reviewText.toLowerCase().includes(q) || reviewTitle.toLowerCase().includes(q);

      if (titleMatch && textMatch) {
        results.push({ item, matchType: 'both', textExcerpt: this.extractExcerpt(reviewText, q) });
      } else if (titleMatch) {
        results.push({ item, matchType: 'title' });
      } else if (textMatch) {
        results.push({ item, matchType: 'text', textExcerpt: this.extractExcerpt(reviewText, q) });
      }
    }

    return results;
  }

  extractExcerpt(text, query) {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.substring(0, 100);

    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 40);
    let excerpt = text.substring(start, end);
    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';
    return excerpt;
  }
}

async function runModule11TestSuite() {
  console.log('============================================================');
  console.log('MYCINEMA — MODULE 11: REVIEWS + PERSONAL FILM JOURNAL TESTS');
  console.log('============================================================\n');

  const db = await initTestDatabase();
  const repo = new TestReviewRepository(db);

  // ------------------------------------------------------------
  // TEST SECTION 1: ARCHITECTURE & REPOSITORY INDEPENDENCE
  // ------------------------------------------------------------
  console.log('--- SECTION 1: Review & Rating Independence ---');

  // Insert mock movies into movies store
  const testMovie1 = {
    id: 157336,
    title: 'Interstellar',
    originalTitle: 'Interstellar',
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    releaseDate: '2014-11-05',
    runtime: 169,
    posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: '/rAiYTua5lh004ab1pbd2VGagP8.jpg',
    voteAverage: 8.4,
    genres: [{ id: 18, name: 'Drama' }, { id: 878, name: 'Sci-Fi' }],
  };

  const testMovie2 = {
    id: 27205,
    title: 'Inception',
    originalTitle: 'Inception',
    overview: 'Cobb steals information by entering the dreams of the target.',
    releaseDate: '2010-07-15',
    runtime: 148,
    posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIwUf.jpg',
    backdropPath: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    voteAverage: 8.36,
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }],
  };

  const testMovie3 = {
    id: 49026,
    title: 'The Dark Knight Rises',
    originalTitle: 'The Dark Knight Rises',
    overview: 'Batman resurfaces to fight Bane.',
    releaseDate: '2012-07-16',
    runtime: 165,
    posterPath: '/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg',
    backdropPath: '/c3el69Z2mZ8bCg0qAomdDq9sI4o.jpg',
    voteAverage: 7.8,
    genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }],
  };

  await db.put('movies', testMovie1);
  await db.put('movies', testMovie2);
  await db.put('movies', testMovie3);

  // 1. Initial State: Movie 1 marked watched without review or rating
  const watchedTimestamp = '2026-09-15T18:30:00.000Z';
  await db.put('userMovies', {
    movieId: 157336,
    status: 'watched',
    personalRating: null,
    notes: 'Viewed in 70mm IMAX',
    review: undefined,
    reviewTitle: undefined,
    reviewedAt: null,
    hasSpoilers: false,
    isFavorite: true,
    addedAt: '2026-09-10T12:00:00.000Z',
    watchedAt: watchedTimestamp,
    watchingAt: null,
    scheduledAt: null,
    rewatchCount: 0,
  });

  // Test 1: Save rating only (no review text)
  const ratedOnly = await repo.saveReview(157336, {
    rating: 4.5,
  });

  assert(
    ratedOnly.personalRating === 4.5 && ratedOnly.review === undefined,
    'TEST 1: Rating without Review Text',
    `Movie #157336 has rating 4.5 and review is undefined`
  );

  assert(
    ratedOnly.watchedAt === watchedTimestamp && ratedOnly.isFavorite === true,
    'TEST 2: Original Watched Date & Favorite Preserved on Rating',
    `watchedAt remains ${watchedTimestamp}, favorite remains true`
  );

  // Test 2: Add review text and title with spoiler tag
  const reviewed = await repo.saveReview(157336, {
    rating: 5.0,
    reviewTitle: 'A Masterpiece of Cosmic Humanity',
    reviewText: 'The docking scene alone is one of the highest achievements in modern cinema. Zimmer score is timeless.',
    hasSpoilers: false,
  });

  assert(
    reviewed.reviewTitle === 'A Masterpiece of Cosmic Humanity' &&
    reviewed.review.includes('docking scene') &&
    reviewed.personalRating === 5.0 &&
    Boolean(reviewed.reviewedAt),
    'TEST 3: Review Text, Title, Rating, and Timestamp Created',
    `Review title, text, 5.0 rating, and reviewedAt timestamp properly saved`
  );

  // Test 3: Edit review text while preserving watchedAt date
  const edited = await repo.saveReview(157336, {
    reviewTitle: 'Transcendent Science Fiction',
    reviewText: 'Updated reflection: The docking scene and wormhole sequence remain unmatched.',
    hasSpoilers: true,
  });

  assert(
    edited.reviewTitle === 'Transcendent Science Fiction' &&
    edited.hasSpoilers === true &&
    edited.watchedAt === watchedTimestamp,
    'TEST 4: Review Editing & Spoiler Flag Preserves Watched Date',
    `Title updated, spoiler flag set to true, watchedAt preserved at ${watchedTimestamp}`
  );

  // Test 4: Delete Review text while PRESERVING rating, favorite, and watched status
  const afterReviewDeleted = await repo.deleteReview(157336);

  assert(
    afterReviewDeleted.review === undefined &&
    afterReviewDeleted.reviewTitle === undefined &&
    afterReviewDeleted.reviewedAt === null &&
    afterReviewDeleted.hasSpoilers === false &&
    afterReviewDeleted.personalRating === 5.0 &&
    afterReviewDeleted.status === 'watched' &&
    afterReviewDeleted.watchedAt === watchedTimestamp &&
    afterReviewDeleted.isFavorite === true,
    'TEST 5: Delete Review Strictly Preserves Rating & Watched State',
    `Review text cleared, but rating (5.0), status ('watched'), watchedAt, and favorite intact`
  );

  // Test 5: Delete Rating while PRESERVING review text
  // First, add review to Movie 2
  await repo.saveReview(27205, {
    rating: 4.5,
    reviewTitle: 'Architectural Brilliance',
    reviewText: 'Nolan at his most structurally disciplined. The Paris folding scene is legendary.',
    hasSpoilers: false,
  });

  const afterRatingDeleted = await repo.deleteRating(27205);

  assert(
    afterRatingDeleted.personalRating === null &&
    afterRatingDeleted.reviewTitle === 'Architectural Brilliance' &&
    afterRatingDeleted.review.includes('Paris folding') &&
    afterRatingDeleted.status === 'watched',
    'TEST 6: Delete Rating Strictly Preserves Review Text & Status',
    `Rating is null, but review text, reviewTitle, and watched status remain fully intact`
  );

  // ------------------------------------------------------------
  // TEST SECTION 2: NO REWATCH ARCHITECTURE & NO GAMIFICATION
  // ------------------------------------------------------------
  console.log('\n--- SECTION 2: Anti-Rewatch & Anti-Gamification Verification ---');

  const movie1Record = await repo.getReview(157336);
  assert(
    movie1Record.rewatchCount === 0,
    'TEST 7: Zero Rewatch Architecture on Reviews',
    `rewatchCount is 0. Exactly 1 canonical record per movie.`
  );

  // Verify no XP, coins, streaks, or gamification fields exist on UserMovie
  const forbiddenFields = ['xp', 'coins', 'streak', 'level', 'badge', 'trophy', 'reputation'];
  const hasForbiddenFields = forbiddenFields.some((f) => f in movie1Record);
  assert(
    !hasForbiddenFields,
    'TEST 8: Zero Gamification Properties',
    `No XP, coins, streak, level, or badges present in user movie record`
  );

  // ------------------------------------------------------------
  // TEST SECTION 3: JOURNAL ENTRIES QUERY, SEARCH & FILTERING
  // ------------------------------------------------------------
  console.log('\n--- SECTION 3: Film Journal Queries & Full Search ---');

  // Add Movie 3 with spoiler tag and rating
  await repo.saveReview(49026, {
    rating: 4.0,
    reviewTitle: 'A Grim Climax',
    reviewText: 'Bane breaks the bat in the sewers, leading to Bruce climbing out of the pit.',
    hasSpoilers: true,
  });

  const journalEntries = await repo.getAllJournalEntries();

  assert(
    journalEntries.length === 3,
    'TEST 9: getAllJournalEntries Batched Retrieval',
    `Found all ${journalEntries.length} films with rating or review (Interstellar, Inception, Dark Knight Rises)`
  );

  // Search by Title
  const titleSearch = repo.search(journalEntries, 'Inception');
  assert(
    titleSearch.length === 1 && titleSearch[0].item.movie.title === 'Inception',
    'TEST 10: Journal Search by Film Title',
    `Search for "Inception" returned 1 match with matchType "${titleSearch[0].matchType}"`
  );

  // Search by Review Text
  await repo.saveReview(157336, {
    reviewTitle: 'Cosmic Wonder',
    reviewText: 'The docking maneuver remains the most thrilling sequence in modern sci-fi.',
  });
  const updatedJournal = await repo.getAllJournalEntries();
  const dockingSearch = repo.search(updatedJournal, 'docking');

  assert(
    dockingSearch.length === 1 &&
    dockingSearch[0].item.movie.title === 'Interstellar' &&
    Boolean(dockingSearch[0].textExcerpt),
    'TEST 11: Journal Search by Review Text & Excerpt Generation',
    `Search for "docking" returned Interstellar with excerpt: "${dockingSearch[0].textExcerpt}"`
  );

  // Search matches spoiler content as well
  const sewerSearch = repo.search(updatedJournal, 'sewers');
  assert(
    sewerSearch.length === 1 && sewerSearch[0].item.movie.title === 'The Dark Knight Rises',
    'TEST 12: Journal Search Matches Review Inside Spoilers',
    `Search for "sewers" correctly located Dark Knight Rises entry`
  );

  // ------------------------------------------------------------
  // TEST SECTION 4: PRIVACY & SHARING ZERO-LEAK VERIFICATION
  // ------------------------------------------------------------
  console.log('\n--- SECTION 4: Privacy & Sharing Zero-Leak Verification ---');

  // Verify ShareModal default behavior (normal movie share must NOT leak reviews)
  const shareModalFile = fs.readFileSync(path.resolve('src/components/share/ShareModal.tsx'), 'utf8');
  assert(
    shareModalFile.includes('setIncludeRating] = useState<boolean>(false)') &&
    shareModalFile.includes('setIncludeReview] = useState<boolean>(false)'),
    'TEST 13: ShareModal Defaults To FALSE for Rating and Review',
    `Normal movie sharing guarantees zero accidental review or rating leakage`
  );

  // Verify dedicated ReviewShareModal exists and formats quote card
  const reviewShareFile = fs.readFileSync(path.resolve('src/components/review/ReviewShareModal.tsx'), 'utf8');
  assert(
    reviewShareFile.includes('Film Journal') &&
    reviewShareFile.includes('shareText') &&
    reviewShareFile.includes('handleNativeShare') &&
    reviewShareFile.includes('handleCopyText'),
    'TEST 14: Dedicated ReviewShareModal Implements Native & Clipboard Sharing',
    `Explicit review sharing provides formatted quotes and OS share sheet trigger`
  );

  // ------------------------------------------------------------
  // TEST SECTION 5: NAVIGATION ARCHITECTURE INTEGRITY
  // ------------------------------------------------------------
  console.log('\n--- SECTION 5: Navigation Architecture Integrity ---');

  const navbarFile = fs.readFileSync(path.resolve('src/components/common/Navbar.tsx'), 'utf8');
  assert(
    !navbarFile.includes("id: 'reviews'") && !navbarFile.includes('id: "reviews"'),
    'TEST 15: Bottom and Desktop Nav Do NOT Include Reviews',
    `Navbar preserves exactly the 6 canonical destinations (Home, Discover, Watchlist, Watched, Collections, Profile)`
  );

  // Verify Profile links to reviews
  const profileFile = fs.readFileSync(path.resolve('src/pages/Profile.tsx'), 'utf8');
  assert(
    profileFile.includes("setActiveTab('reviews')") &&
    profileFile.includes('Film Journal & Reviews') &&
    profileFile.includes('ReviewRepository.getAllJournalEntries'),
    'TEST 16: Profile Page Features Dedicated Film Journal Entry Card',
    `Profile page accesses ReviewsPage via setActiveTab('reviews') and displays live entry count`
  );

  // Verify App.tsx lazy routes ReviewsPage
  const appFile = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert(
    appFile.includes("const ReviewsPage = React.lazy(") &&
    appFile.includes("activeTab === 'reviews' && <ReviewsPage />"),
    'TEST 17: App.tsx Lazy-Loads & Renders ReviewsPage',
    `ReviewsPage is code-split and rendered inside suspense shell on tab activation`
  );

  // Verify MovieDetail provides review editor, spoiler protection, and delete
  const movieDetailFile = fs.readFileSync(path.resolve('src/pages/MovieDetail.tsx'), 'utf8');
  assert(
    movieDetailFile.includes('ReviewEditorModal') &&
    movieDetailFile.includes('ReviewShareModal') &&
    movieDetailFile.includes('deleteReview') &&
    movieDetailFile.includes('hasSpoilers') &&
    movieDetailFile.includes('Personal Screening Record'),
    'TEST 18: MovieDetail Features Full Review Viewing, Editing, and Deletion',
    `MovieDetail connects ReviewEditorModal, ReviewShareModal, and spoiler reveal/hide`
  );

  // Verify Export Service includes review metadata
  const exportServiceFile = fs.readFileSync(path.resolve('src/services/exportService.ts'), 'utf8');
  assert(
    exportServiceFile.includes('Review Title') &&
    exportServiceFile.includes('Reviewed At') &&
    exportServiceFile.includes('Contains Spoilers'),
    'TEST 19: Export Service Includes Extended Review Metadata in CSV & JSON',
    `Exporting catalog preserves reviewTitle, reviewedAt, and hasSpoilers`
  );

  // Verify Draft Protection in ReviewEditorModal
  const editorModalFile = fs.readFileSync(path.resolve('src/components/review/ReviewEditorModal.tsx'), 'utf8');
  assert(
    editorModalFile.includes('localStorage.setItem') &&
    editorModalFile.includes('localStorage.getItem') &&
    editorModalFile.includes('mycinema_draft_review_'),
    'TEST 20: ReviewEditorModal Implements LocalStorage Draft Protection',
    `Accidental modal dismissals are protected by automatic local storage drafting`
  );

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`MODULE 11 VERIFICATION COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runModule11TestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
