import 'fake-indexeddb/auto';
import { getDB } from '../src/db/database.ts';
import { CollectionRepository } from '../src/db/repositories/collectionRepository.ts';

async function runCollectionCRUDTest() {
  console.log('============================================================');
  console.log('COLLECTION CRUD FORENSIC & INTEGRITY TEST');
  console.log('============================================================');

  // 1. Create Collection A, B, C
  console.log('\n--- Step 1: Create Collections A, B, C ---');
  const colA = await CollectionRepository.create({
    name: 'Collection A - Nolan',
    description: 'Nolan filmography',
    coverType: 'collage',
    sortMode: 'releaseDate',
  });
  console.log('Created A:', colA.id, colA.name, colA.coverType, colA.sortMode);

  const colB = await CollectionRepository.create({
    name: 'Collection B - Sci-Fi Favorites',
    description: 'Favorite science fiction films',
    coverType: 'hero',
    sortMode: 'rating',
  });
  console.log('Created B:', colB.id, colB.name, colB.coverType, colB.sortMode);

  const colC = await CollectionRepository.create({
    name: 'Collection C - Anime Sagas',
    description: 'Animation classics',
    coverType: 'collage',
    sortMode: 'title',
  });
  console.log('Created C:', colC.id, colC.name, colC.coverType, colC.sortMode);

  // 2. Read all and verify each retains its distinct attributes
  console.log('\n--- Step 2: Read and Verify Distinct Attributes ---');
  const all = await CollectionRepository.getAll();
  console.log('Total collections in DB:', all.length);
  if (all.length !== 3) throw new Error(`Expected 3 collections, got ${all.length}`);

  const fetchedA = all.find(c => c.id === colA.id);
  const fetchedB = all.find(c => c.id === colB.id);
  const fetchedC = all.find(c => c.id === colC.id);

  if (!fetchedA || fetchedA.name !== 'Collection A - Nolan' || fetchedA.sortMode !== 'releaseDate') {
    throw new Error('Collection A verification failed');
  }
  if (!fetchedB || fetchedB.name !== 'Collection B - Sci-Fi Favorites' || fetchedB.coverType !== 'hero') {
    throw new Error('Collection B verification failed');
  }
  if (!fetchedC || fetchedC.name !== 'Collection C - Anime Sagas' || fetchedC.sortMode !== 'title') {
    throw new Error('Collection C verification failed');
  }
  console.log('[PASS] A, B, and C verified with exact distinct attributes');

  // 3. Update A
  console.log('\n--- Step 3: Update Collection A ---');
  fetchedA.name = 'Collection A - Renamed Nolan Masterpieces';
  fetchedA.description = 'Updated description';
  fetchedA.coverType = 'hero';
  fetchedA.sortMode = 'custom';
  await CollectionRepository.update(fetchedA);

  const reloadedA = await CollectionRepository.getById(colA.id);
  if (!reloadedA || reloadedA.name !== 'Collection A - Renamed Nolan Masterpieces' || reloadedA.coverType !== 'hero' || reloadedA.sortMode !== 'custom') {
    throw new Error('Collection A update failed to persist');
  }
  console.log('[PASS] Collection A update persisted correctly');

  // 4. Delete B
  console.log('\n--- Step 4: Delete Collection B ---');
  await CollectionRepository.delete(colB.id);
  const afterDeleteB = await CollectionRepository.getAll();
  console.log('Collections count after deleting B:', afterDeleteB.length);
  if (afterDeleteB.some(c => c.id === colB.id)) throw new Error('Collection B was not deleted');
  if (!afterDeleteB.some(c => c.id === colA.id)) throw new Error('Collection A was mistakenly deleted');
  if (!afterDeleteB.some(c => c.id === colC.id)) throw new Error('Collection C was mistakenly deleted');
  console.log('[PASS] Only B was deleted; A and C remain completely intact');

  // 5. Test duplicate name handling
  console.log('\n--- Step 5: Duplicate Name Handling ---');
  const duplicateA = await CollectionRepository.create({
    name: 'Collection C - Anime Sagas', // Same name as C
    description: 'Second anime collection',
  });
  console.log('Created duplicate name collection with ID:', duplicateA.id);
  if (duplicateA.id === colC.id) throw new Error('Duplicate name caused ID collision');
  const afterDuplicate = await CollectionRepository.getAll();
  const cMatches = afterDuplicate.filter(c => c.name === 'Collection C - Anime Sagas');
  if (cMatches.length !== 2) throw new Error('Both collections with same title should exist independently by unique ID');
  console.log('[PASS] Duplicate name creates separate unique record by ID');

  console.log('\n============================================================');
  console.log('COLLECTION CRUD TEST PASSED 100%');
  console.log('============================================================');
}

runCollectionCRUDTest().catch((err) => {
  console.error('\n[FAIL] Test encountered error:', err);
  process.exit(1);
});
