import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PHOTOS, MemoryPhotoStore, keysToEvict, photoFilename } from '../js/photo-store.js';

test('keysToEvict removes only the oldest overflow', () => {
  assert.deepEqual(keysToEvict([1, 2, 3], 5), []);
  assert.deepEqual(keysToEvict([1, 2, 3, 4, 5], 5), []);
  assert.deepEqual(keysToEvict([1, 2, 3, 4, 5, 6, 7], 5), [1, 2]);
});

test('the store keeps only the newest pictures, newest first', async () => {
  const store = new MemoryPhotoStore();
  for (let n = 1; n <= MAX_PHOTOS + 2; n++) await store.add({ n });
  const photos = await store.list();
  assert.deepEqual(photos.map((p) => p.n), [7, 6, 5, 4, 3]);
});

test('remove deletes one picture and ids are never reused', async () => {
  const store = new MemoryPhotoStore();
  const first = await store.add({ n: 1 });
  await store.add({ n: 2 });
  await store.remove(first.id);
  const third = await store.add({ n: 3 });
  assert.equal(third.id, 3);
  assert.deepEqual((await store.list()).map((p) => p.n), [3, 2]);
});

test('photoFilename uses a sortable local timestamp', () => {
  const createdAt = new Date(2026, 10, 6, 20, 30, 15).getTime();
  assert.equal(photoFilename({ createdAt }), 'picsall-2026-11-06-203015.jpg');
});
