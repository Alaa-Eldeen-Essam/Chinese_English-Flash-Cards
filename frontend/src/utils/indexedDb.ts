import type { DatasetMeta, DictWord, SyncQueueItem, UserData } from "../types";

const DB_NAME = "sc-flashcards";
const DB_VERSION = 2;
const STORE_APP = "app";
const STORE_QUEUE = "queue";
const STORE_DATASET_META = "dataset_meta";
const STORE_DATASET_ENTRIES = "dataset_entries";

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
      if (!db.objectStoreNames.contains(STORE_DATASET_META)) {
        db.createObjectStore(STORE_DATASET_META, { keyPath: "dataset_id" });
      }
      if (!db.objectStoreNames.contains(STORE_DATASET_ENTRIES)) {
        const store = db.createObjectStore(STORE_DATASET_ENTRIES, { keyPath: "key" });
        store.createIndex("dataset_id", "dataset_id", { unique: false });
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

export async function getDatasetMeta(): Promise<DatasetMeta[]> {
  const results = await withStore<DatasetMeta[] | undefined>(
    STORE_DATASET_META,
    "readonly",
    (store) => store.getAll()
  );
  return results ?? [];
}

export async function getDatasetMetaById(datasetId: string): Promise<DatasetMeta | null> {
  const result = await withStore<DatasetMeta | undefined>(
    STORE_DATASET_META,
    "readonly",
    (store) => store.get(datasetId)
  );
  return result ?? null;
}

export async function setDatasetMeta(meta: DatasetMeta): Promise<void> {
  await withStore(STORE_DATASET_META, "readwrite", (store) => store.put(meta));
}

export async function storeDatasetEntries(datasetId: string, entries: DictWord[]): Promise<void> {
  await withStore(STORE_DATASET_ENTRIES, "readwrite", (store) => {
    entries.forEach((entry) => {
      store.put({
        key: `${datasetId}:${entry.id}`,
        dataset_id: datasetId,
        entry
      });
    });
    return store.getAll();
  });
}

export async function countDatasetEntries(datasetId: string): Promise<number> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DATASET_ENTRIES, "readonly");
        const store = tx.objectStore(STORE_DATASET_ENTRIES);
        const index = store.index("dataset_id");
        const request = index.count(IDBKeyRange.only(datasetId));
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export async function clearDatasetEntries(datasetId: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DATASET_ENTRIES, "readwrite");
        const store = tx.objectStore(STORE_DATASET_ENTRIES);
        const index = store.index("dataset_id");
        const request = index.openCursor(IDBKeyRange.only(datasetId));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}
