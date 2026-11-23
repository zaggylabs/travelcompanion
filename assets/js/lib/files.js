// Attachments (tickets, booking PDFs, screenshots) live in this browser's
// IndexedDB, which handles files far better than localStorage. Each trip item
// keeps a small list of { id, name, type, size } so rows render without
// waiting on the database; the file itself is stored here by that id.

const DB_NAME = "travelcompanion-files";
const STORE = "files";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ACCEPT = "image/*,application/pdf,.pdf";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("itemId", "itemId");
      store.createIndex("tripId", "tripId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  }));
}

/** Stores one file. Returns the metadata to keep on the item. */
export async function putFile({ id, tripId, itemId, file }) {
  const meta = { id, name: file.name || "Attachment", type: file.type || "", size: file.size };
  // Store a plain Blob: some browsers can't persist File objects from inputs.
  const blob = new Blob([await file.arrayBuffer()], { type: meta.type });
  await run("readwrite", (s) => s.put({ ...meta, tripId, itemId, blob, addedAt: new Date().toISOString() }));
  return meta;
}

export function getFile(id) {
  return run("readonly", (s) => s.get(id));
}

export function deleteFile(id) {
  return run("readwrite", (s) => { s.delete(id); });
}

function deleteBy(indexName, key) {
  return run("readwrite", (s) => {
    const req = s.index(indexName).openKeyCursor(IDBKeyRange.only(key));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { s.delete(c.primaryKey); c.continue(); }
    };
  });
}

export const deleteItemFiles = (itemId) => deleteBy("itemId", itemId).catch(() => {});
export const deleteTripFiles = (tripId) => deleteBy("tripId", tripId).catch(() => {});

/** Asks the browser not to evict our files when space runs low. Best effort. */
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isAllowedType(file) {
  return (file.type || "").startsWith("image/") || file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}
