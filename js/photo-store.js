// Keeps the most recent pictures on this device.
//
// A photo is { id, blob, createdAt, direction, seconds, width, height }.
// Both stores share the same interface: list() newest first, add(), remove().

export const MAX_PHOTOS = 5;

const DB_NAME = 'picsall';
const STORE_NAME = 'photos';

/** Given keys oldest first, which ones have to go to stay within `max`. */
export function keysToEvict(keys, max = MAX_PHOTOS) {
  return keys.slice(0, Math.max(0, keys.length - max));
}

/** e.g. picsall-2026-11-06-203015.jpg, in local time. */
export function photoFilename(photo) {
  const d = new Date(photo.createdAt);
  const two = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const time = `${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  return `picsall-${date}-${time}.jpg`;
}

/** Used when IndexedDB is unavailable: pictures last until the page closes. */
export class MemoryPhotoStore {
  #photos = [];
  #nextId = 1;

  async list() {
    return [...this.#photos].reverse();
  }

  async add(photo) {
    const saved = { ...photo, id: this.#nextId++ };
    this.#photos.push(saved);
    const evicted = keysToEvict(this.#photos.map((p) => p.id));
    this.#photos = this.#photos.filter((p) => !evicted.includes(p.id));
    return saved;
  }

  async remove(id) {
    this.#photos = this.#photos.filter((p) => p.id !== id);
  }
}

class IndexedDbPhotoStore {
  #db;

  constructor(db) {
    this.#db = db;
  }

  async list() {
    const tx = this.#db.transaction(STORE_NAME);
    const photos = await request(tx.objectStore(STORE_NAME).getAll());
    return photos.reverse();
  }

  async add(photo) {
    const tx = this.#db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const id = await request(store.add(photo));
    const keys = await request(store.getAllKeys());
    keysToEvict(keys).forEach((key) => store.delete(key));
    await transactionDone(tx);
    return { ...photo, id };
  }

  async remove(id) {
    const tx = this.#db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await transactionDone(tx);
  }
}

export async function openPhotoStore() {
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    return new IndexedDbPhotoStore(await request(open));
  } catch (error) {
    console.warn('IndexedDB unavailable, keeping pictures in memory only', error);
    return new MemoryPhotoStore();
  }
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
