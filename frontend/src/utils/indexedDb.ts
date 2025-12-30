import type { SyncQueueItem, UserData } from "../types";

const DB_NAME = "sc-flashcards";
const DB_VERSION = 1;
const STORE_APP = "app";
const STORE_QUEUE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_APP)) {
        db.createObjectStore(STORE_APP, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export async function getUserData(): Promise<UserData | null> {
  const result = await withStore<{ key: string; value: UserData } | undefined>(
    STORE_APP,
    "readonly",
    (store) => store.get("userData")
  );
  return result?.value ?? null;
}

export async function setUserData(value: UserData): Promise<void> {
  await withStore(
    STORE_APP,
    "readwrite",
    (store) => store.put({ key: "userData", value })
  );
}

export async function getQueue(): Promise<SyncQueueItem[]> {
  const results = await withStore<SyncQueueItem[] | undefined>(
    STORE_QUEUE,
    "readonly",
    (store) => store.getAll()
  );
  return results ?? [];
}

export async function enqueue(item: SyncQueueItem): Promise<void> {
  await withStore(STORE_QUEUE, "readwrite", (store) => store.put(item));
}

export async function clearQueue(ids?: string[]): Promise<void> {
  if (!ids || ids.length === 0) {
    await withStore(STORE_QUEUE, "readwrite", (store) => store.clear());
    return;
  }

  await withStore(STORE_QUEUE, "readwrite", (store) => {
    ids.forEach((id) => store.delete(id));
    return store.getAll();
  });
}
