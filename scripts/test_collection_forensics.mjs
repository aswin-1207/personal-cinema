import 'fake-indexeddb/auto';
import { getDB } from '../src/db/database.ts';
import { CollectionRepository } from '../src/db/repositories/collectionRepository.ts';

async function runForensics() {
  console.log('=== COLLECTION FORENSIC TEST ===');
  
  const db = await getDB();
  console.log('IndexedDB opened successfully. Stores:', Array.from(db.objectStoreNames));
  
  // Test 1: Create Collection with standard name
  try {
    const col1 = await CollectionRepository.create({
      name: 'Christopher Nolan Films',
      description: 'Master of time and non-linear narrative',
      coverType: 'collage',
      sortMode: 'custom',
    });
    console.log('[PASS] Created col1:', col1.id, col1.name);
  } catch (err) {
    console.error('[FAIL] Create col1 failed:', err);
  }

  // Test 2: Check getAll
  const all1 = await CollectionRepository.getAll();
  console.log('getAll count:', all1.length);
  if (all1.length !== 1) console.error('[FAIL] Expected 1 collection, got', all1.length);
  else console.log('[PASS] Collection retrieved via getAll');

  // Test 3: What if crypto is undefined?
  const originalCrypto = globalThis.crypto;
  try {
    delete globalThis.crypto;
    const col2 = await CollectionRepository.create({
      name: 'Denis Villeneuve Sagas',
      description: 'Atmospheric sci-fi',
      coverType: 'hero',
      sortMode: 'releaseDate',
    });
    console.log('[PASS] Created col2 without crypto:', col2.id, col2.name);
  } catch (err) {
    console.error('[FAIL] Create without crypto failed:', err.message);
  } finally {
    globalThis.crypto = originalCrypto;
  }

  // Test 4: Check if collections persist and can be read back
  const all2 = await CollectionRepository.getAll();
  console.log('Collections in DB:', all2.map(c => ({ id: c.id, name: c.name })));
}

runForensics().catch(console.error);
