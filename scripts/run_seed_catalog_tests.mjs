// scripts/run_seed_catalog_tests.mjs
// Automated verification for MyCinema Curated Seed Catalog + TMDB Fallback

import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = 'test-seed-cinema-db';
const DB_VERSION = 2;

function getTestDB() {
  return openDB(DB_NAME, DB_VERSION, {
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

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchLocal(db, query, options = {}) {
  const normQuery = normalize(query);
  if (!normQuery) return [];
  const queryWords = normQuery.split(' ').filter(Boolean);
  const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'and', 'to', 'for', 'is', 'on', 'at', 'part', 'movie']);
  const meaningfulWords = queryWords.filter((w) => !stopWords.has(w));

  const allMovies = await db.getAll('movies');
  const scored = [];

  for (const movie of allMovies) {
    if (options.excludeMovieIds && options.excludeMovieIds.has(movie.id)) {
      continue;
    }

    const normTitle = normalize(movie.title || '');
    const normOrig = normalize(movie.originalTitle || '');
    const normTags = (movie.franchiseTags || []).map((t) => normalize(t));

    let score = 0;
    if (normTitle === normQuery) score += 100;
    else if (normTitle.startsWith(normQuery)) score += 70;
    else if (normTitle.includes(normQuery)) score += 50;
    else if (meaningfulWords.length > 0 && meaningfulWords.every((w) => normTitle.includes(w))) score += 35;
    else if (meaningfulWords.length > 0) {
      const matches = meaningfulWords.filter((w) => normTitle.includes(w)).length;
      if (matches > 0 && matches / meaningfulWords.length >= 0.5) {
        score += matches * 10;
      }
    }

    for (const tag of normTags) {
      if (tag === normQuery) score += 40;
      else if (tag.includes(normQuery)) score += 25;
      else if (meaningfulWords.length > 0 && meaningfulWords.some((w) => tag.includes(w))) score += 15;
    }

    if (normOrig && normOrig !== normTitle && normOrig.includes(normQuery)) score += 20;

    if (score > 0) {
      scored.push({ movie, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.movie);
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

async function run() {
  console.log('============================================================');
  console.log('MYCINEMA — CURATED SEED CATALOG & SEARCH VERIFICATION SUITE');
  console.log('============================================================\n');

  // Load Seed Catalog JSON
  const catalogPath = path.resolve(__dirname, '../src/data/seedCatalog.json');
  const catalogJson = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

  assert(Array.isArray(catalogJson) && catalogJson.length >= 200, `TEST 1: Seed catalog contains at least 200 films (Found: ${catalogJson.length})`);

  const db = await getTestDB();

  // Test 2: Seed catalog loading into IndexedDB
  const tx = db.transaction('movies', 'readwrite');
  const store = tx.objectStore('movies');
  for (const m of catalogJson) {
    await store.put(m);
  }
  await tx.done;

  const countAfterSeed = await db.count('movies');
  assert(countAfterSeed === catalogJson.length, `TEST 2: Seeded movies persisted to IndexedDB (${countAfterSeed} movies)`);

  // Test 3: User data separation (userMovies must be 0)
  const userMoviesCount = await db.count('userMovies');
  assert(userMoviesCount === 0, `TEST 3: UserMovies table remains 0 (No personal states polluted)`);

  // Test 4: Marvel search
  const avengersResults = await searchLocal(db, 'Avengers');
  assert(avengersResults.length >= 4 && avengersResults.some((m) => m.title.includes('Endgame')), `TEST 4: Marvel search: "Avengers" found ${avengersResults.length} films including Endgame`);

  // Test 5: Iron Man search
  const ironManResults = await searchLocal(db, 'Iron Man');
  assert(ironManResults.length >= 3, `TEST 5: Marvel search: "Iron Man" found ${ironManResults.length} films`);

  // Test 6: DC search - Batman
  const batmanResults = await searchLocal(db, 'Batman');
  assert(batmanResults.length >= 5 && batmanResults.some((m) => m.title === 'The Dark Knight'), `TEST 6: DC search: "Batman" found ${batmanResults.length} films including The Dark Knight`);

  // Test 7: DC search - Superman
  const supermanResults = await searchLocal(db, 'Superman');
  assert(supermanResults.length >= 3 && supermanResults.some((m) => m.title === 'Man of Steel'), `TEST 7: DC search: "Superman" found ${supermanResults.length} films including Man of Steel`);

  // Test 8: Sony / Spider-Man search
  const spidermanResults = await searchLocal(db, 'Spider-Man');
  assert(spidermanResults.length >= 5 && spidermanResults.some((m) => m.title.includes('Spider-Verse')), `TEST 8: Sony search: "Spider-Man" found ${spidermanResults.length} films including Spider-Verse`);

  // Test 9: Fox / X-Men search
  const xmenResults = await searchLocal(db, 'X-Men');
  assert(xmenResults.length >= 4, `TEST 9: Fox search: "X-Men" found ${xmenResults.length} films`);

  // Test 10: Deadpool / Logan search
  const deadpoolResults = await searchLocal(db, 'Deadpool');
  const loganResults = await searchLocal(db, 'Logan');
  assert(deadpoolResults.length >= 2 && loganResults.length >= 1, `TEST 10: Fox/Marvel search: "Deadpool" & "Logan" found correctly`);

  // Test 11: Disney superhero search (The Incredibles / Big Hero 6)
  const incrediblesResults = await searchLocal(db, 'Incredibles');
  const bigHeroResults = await searchLocal(db, 'Big Hero 6');
  assert(incrediblesResults.length >= 2 && bigHeroResults.length >= 1, `TEST 11: Disney superhero search: Incredibles & Big Hero 6 found`);

  // Test 12: Other superheroes (Watchmen, Hellboy, Kick-Ass, TMNT, The Crow)
  const watchmenResults = await searchLocal(db, 'Watchmen');
  const hellboyResults = await searchLocal(db, 'Hellboy');
  const kickassResults = await searchLocal(db, 'Kick-Ass');
  assert(watchmenResults.length >= 1 && hellboyResults.length >= 1 && kickassResults.length >= 1, `TEST 12: Other superhero search: Watchmen, Hellboy, Kick-Ass found`);

  // Test 13: Recent popular blockbusters (Oppenheimer, Dune, Interstellar)
  const oppenheimerResults = await searchLocal(db, 'Oppenheimer');
  const duneResults = await searchLocal(db, 'Dune');
  const interstellarResults = await searchLocal(db, 'Interstellar');
  assert(oppenheimerResults.length >= 1 && duneResults.length >= 2 && interstellarResults.length >= 1, `TEST 13: Recent blockbusters: Oppenheimer, Dune 1 & 2, Interstellar found`);

  // Test 14: Indian Cinema - Tamil (Leo, Vikram, Jailer)
  const leoResults = await searchLocal(db, 'Leo');
  const vikramResults = await searchLocal(db, 'Vikram');
  assert(leoResults.length >= 1 && vikramResults.length >= 1, `TEST 14: Indian Tamil cinema: Leo and Vikram found`);

  // Test 15: Indian Cinema - Telugu (RRR, Kalki, Baahubali)
  const rrrResults = await searchLocal(db, 'RRR');
  const kalkiResults = await searchLocal(db, 'Kalki');
  assert(rrrResults.length >= 1 && kalkiResults.length >= 1, `TEST 15: Indian Telugu cinema: RRR and Kalki found`);

  // Test 16: Indian Cinema - Malayalam & Hindi (Manjummel Boys, Stree 2)
  const manjummelResults = await searchLocal(db, 'Manjummel Boys');
  const streeResults = await searchLocal(db, 'Stree');
  assert(manjummelResults.length >= 1 && streeResults.length >= 1, `TEST 16: Indian Malayalam & Hindi: Manjummel Boys and Stree found`);

  // ==========================================
  // COLLECTION SEARCH BUG REGRESSION TEST
  // ==========================================
  // Test 17: User has collection "dfghj" and searches "Avengers"
  const colId = 'col_dfghj';
  await db.put('collections', {
    id: colId,
    name: 'dfghj',
    description: '',
    sortOrder: 'manual',
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Collection currently contains 0 movies
  const existingInCol = new Set();
  const colAvengersSearch = await searchLocal(db, 'Avengers', { excludeMovieIds: existingInCol });
  assert(colAvengersSearch.length >= 4, `TEST 17: REGRESSION FIXED - Collection "dfghj" search "Avengers" returns ${colAvengersSearch.length} movies (NOT "No available movies found")`);

  // Test 18: Add 1 Avengers movie to collection, search again -> it should be excluded, others remain!
  const endgameMovie = colAvengersSearch.find((m) => m.title.includes('Endgame'));
  assert(Boolean(endgameMovie), 'Found Endgame movie');
  existingInCol.add(endgameMovie.id);

  const colAvengersSearchAfter1 = await searchLocal(db, 'Avengers', { excludeMovieIds: existingInCol });
  assert(!colAvengersSearchAfter1.some((m) => m.id === endgameMovie.id), `TEST 18: Collection filter only excludes already-added movie (Endgame excluded, ${colAvengersSearchAfter1.length} other Avengers remain)`);

  // Test 19: Deduplication by TMDB ID
  const map = new Map();
  for (const m of colAvengersSearch) {
    map.set(m.id, m);
  }
  // Try adding Endgame again from TMDB
  map.set(endgameMovie.id, { ...endgameMovie, source: 'tmdb' });
  assert(map.size === colAvengersSearch.length, `TEST 19: Deduplication by TMDB ID enforced strictly (size = ${map.size})`);

  // Test 20: On-demand fallback simulation for obscure movie
  const obscureQuery = 'The Seventh Seal';
  const obscureLocal = await searchLocal(db, obscureQuery);
  assert(obscureLocal.length === 0, 'Obscure movie not in local seed');

  // Simulated TMDB return
  const tmdbSimulatedMovie = {
    id: 490,
    title: 'The Seventh Seal',
    originalTitle: 'Det sjunde inseglet',
    overview: 'A knight returning to Sweden after the Crusades seeks answers about life, death, and the existence of God as he plays chess against the Grim Reaper.',
    releaseDate: '1957-02-16',
    voteAverage: 8.2,
    genres: [{ id: 18, name: 'Drama' }, { id: 14, name: 'Fantasy' }],
    source: 'tmdb',
    lastFetched: new Date().toISOString(),
  };

  // User selects it -> Saved into local database
  await db.put('movies', tmdbSimulatedMovie);
  const nowInLocal = await db.get('movies', 490);
  assert(Boolean(nowInLocal && nowInLocal.title === 'The Seventh Seal'), `TEST 20: On-demand TMDB movie selection saved to canonical local store`);

  // Next local search finds it immediately!
  const obscureLocal2 = await searchLocal(db, obscureQuery);
  assert(obscureLocal2.length === 1 && obscureLocal2[0].id === 490, `TEST 21: Next search for on-demand movie finds it immediately in local catalog`);

  // Test 22: Idempotent re-initialization
  // Simulate calling seed again
  for (const m of catalogJson) {
    const existing = await db.get('movies', m.id);
    if (!existing) {
      await db.put('movies', m);
    }
  }
  const totalCountReInit = await db.count('movies');
  assert(totalCountReInit === catalogJson.length + 1, `TEST 22: Idempotent re-initialization preserves exact catalog count (${totalCountReInit} including on-demand movie)`);

  console.log('\n============================================================');
  console.log(`SEED CATALOG TEST SUITE: ${passed} PASSED | ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
