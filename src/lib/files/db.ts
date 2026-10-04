import type { StoredFile } from "./types";

/**
 * IndexedDB adapter for uploaded files. localStorage (5 MB) is far too small for documents,
 * so files live in their own database. Everything stays in this browser.
 */
const DB_NAME = "smart-attendance-files";
const STORE = "files";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error("Transaction aborted"));
      }),
  );
}

export const fileDb = {
  all: () => tx<StoredFile[]>("readonly", (s) => s.getAll() as IDBRequest<StoredFile[]>).then((r) => r ?? []),
  put: (f: StoredFile) => tx("readwrite", (s) => s.put(f)).then(() => undefined),
  delete: (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined),
  clear: () => tx("readwrite", (s) => s.clear()).then(() => undefined),
};
