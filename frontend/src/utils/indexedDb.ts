import type { DatasetMeta, DictWord, SyncQueueItem, UserData } from "../types";
import { normalizePinyinInput } from "./pinyin";

const DB_NAME = "sc-flashcards";
const DB_VERSION = 3;
const STORE_APP = "app";
const STORE_QUEUE = "queue";
const STORE_DATASET_META = "dataset_meta";
const STORE_DATASET_ENTRIES = "dataset_entries";

type DictSearchMode = "all" | "simplified" | "traditional" | "pinyin" | "meanings";
type DatasetEntryRecord = {
  key: string;
  dataset_id: string;
  entry: DictWord;
  simplified?: string;
  traditional?: string;
  pinyin_compact?: string;
};

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
      let datasetStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_DATASET_ENTRIES)) {
        datasetStore = db.createObjectStore(STORE_DATASET_ENTRIES, { keyPath: "key" });
      } else {
        datasetStore = request.transaction?.objectStore(STORE_DATASET_ENTRIES) as IDBObjectStore;
      }
      if (datasetStore && !datasetStore.indexNames.contains("dataset_id")) {
        datasetStore.createIndex("dataset_id", "dataset_id", { unique: false });
      }
      if (datasetStore && !datasetStore.indexNames.contains("simplified")) {
        datasetStore.createIndex("simplified", "simplified", { unique: false });
      }
      if (datasetStore && !datasetStore.indexNames.contains("traditional")) {
        datasetStore.createIndex("traditional", "traditional", { unique: false });
      }
      if (datasetStore && !datasetStore.indexNames.contains("pinyin_compact")) {
        datasetStore.createIndex("pinyin_compact", "pinyin_compact", { unique: false });
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
      const normalized = entry.pinyin_normalized ?? normalizePinyinInput(entry.pinyin ?? "");
      const compact = normalized.replace(/\s+/g, "").toLowerCase();
      store.put({
        key: `${datasetId}:${entry.id}`,
        dataset_id: datasetId,
        entry,
        simplified: entry.simplified,
        traditional: entry.traditional ?? "",
        pinyin_compact: compact
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

export async function getDownloadedDatasetIds(): Promise<string[]> {
  const meta = await getDatasetMeta();
  return meta.filter((item) => item.status === "done").map((item) => item.dataset_id);
}

function buildPrefixRange(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`);
}

function isLikelyPinyin(query: string): boolean {
  return /[a-zA-Z0-9\u00fc\u0100-\u01dc]/.test(query);
}

async function searchByIndex(
  indexName: string,
  range: IDBKeyRange,
  datasetIds: string[] | undefined,
  limit: number
): Promise<DictWord[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const results: DictWord[] = [];
        const tx = db.transaction(STORE_DATASET_ENTRIES, "readonly");
        const store = tx.objectStore(STORE_DATASET_ENTRIES);
        const index = store.index(indexName);
        const request = index.openCursor(range);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(results);
            return;
          }
          const record = cursor.value as DatasetEntryRecord;
          if (datasetIds && datasetIds.length > 0 && !datasetIds.includes(record.dataset_id)) {
            cursor.continue();
            return;
          }
          results.push(record.entry);
          if (results.length >= limit) {
            resolve(results);
            return;
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

async function scanEntries(
  query: string,
  datasetIds: string[] | undefined,
  limit: number,
  mode: DictSearchMode
): Promise<DictWord[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const normalizedNeedle = normalizePinyinInput(query);

  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const results: DictWord[] = [];
        const tx = db.transaction(STORE_DATASET_ENTRIES, "readonly");
        const store = tx.objectStore(STORE_DATASET_ENTRIES);
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(results);
            return;
          }
          const record = cursor.value as DatasetEntryRecord;
          if (datasetIds && datasetIds.length > 0 && !datasetIds.includes(record.dataset_id)) {
            cursor.continue();
            return;
          }

          const entry = record.entry;
          const simplified = entry.simplified ?? "";
          const traditional = entry.traditional ?? "";
          const pinyinNormalized = (entry.pinyin_normalized ?? normalizePinyinInput(entry.pinyin ?? ""))
            .replace(/\s+/g, "")
            .toLowerCase();
          const meanings = (entry.meanings ?? []).join("; ").toLowerCase();

          const matches =
            (mode === "simplified" && simplified.includes(query)) ||
            (mode === "traditional" && traditional.includes(query)) ||
            (mode === "pinyin" && normalizedNeedle && pinyinNormalized.includes(normalizedNeedle)) ||
            (mode === "meanings" && meanings.includes(needle)) ||
            (mode === "all" &&
              (simplified.includes(query) ||
                traditional.includes(query) ||
                (normalizedNeedle && pinyinNormalized.includes(normalizedNeedle)) ||
                meanings.includes(needle)));

          if (matches) {
            results.push(entry);
          }
          if (results.length >= limit) {
            resolve(results);
            return;
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export async function searchDatasetEntries(
  query: string,
  options?: {
    mode?: DictSearchMode;
    datasetIds?: string[];
    limit?: number;
  }
): Promise<DictWord[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const mode = options?.mode ?? "all";
  const datasetIds = options?.datasetIds;
  const limit = options?.limit ?? 20;

  if (mode === "simplified") {
    const results = await searchByIndex("simplified", buildPrefixRange(trimmed), datasetIds, limit);
    return results.length > 0 ? results : scanEntries(trimmed, datasetIds, limit, mode);
  }

  if (mode === "traditional") {
    const results = await searchByIndex("traditional", buildPrefixRange(trimmed), datasetIds, limit);
    return results.length > 0 ? results : scanEntries(trimmed, datasetIds, limit, mode);
  }

  if (mode === "pinyin") {
    const normalized = normalizePinyinInput(trimmed);
    if (!normalized) {
      return [];
    }
    const results = await searchByIndex(
      "pinyin_compact",
      buildPrefixRange(normalized),
      datasetIds,
      limit
    );
    return results.length > 0 ? results : scanEntries(trimmed, datasetIds, limit, mode);
  }

  if (mode === "meanings") {
    return scanEntries(trimmed, datasetIds, limit, mode);
  }

  const merged: DictWord[] = [];
  const seen = new Set<number>();
  const addUnique = (entries: DictWord[]) => {
    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        merged.push(entry);
      }
      if (merged.length >= limit) {
        break;
      }
    }
  };

  addUnique(await searchByIndex("simplified", buildPrefixRange(trimmed), datasetIds, limit));
  if (merged.length < limit) {
    addUnique(await searchByIndex("traditional", buildPrefixRange(trimmed), datasetIds, limit));
  }
  if (merged.length < limit && isLikelyPinyin(trimmed)) {
    const normalized = normalizePinyinInput(trimmed);
    if (normalized) {
      addUnique(
        await searchByIndex("pinyin_compact", buildPrefixRange(normalized), datasetIds, limit)
      );
    }
  }

  if (merged.length > 0) {
    return merged;
  }

  return scanEntries(trimmed, datasetIds, limit, mode);
}
