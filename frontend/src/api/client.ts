import type {
  Card,
  Collection,
  ImportJob,
  StudyLog,
  StudyResponse,
  StudySchedule,
  UserData
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const API_PREFIX = `${API_BASE}/api`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function healthCheck(): Promise<{ status: string }> {
  return request(`${API_PREFIX}/admin/health`);
}

export async function fetchUserDump(userId = "me"): Promise<UserData> {
  const url = new URL(`${API_PREFIX}/admin/dump`);
  url.searchParams.set("user_id", userId);
  return request<UserData>(url.toString());
}

export async function syncUserData(payload: {
  user_id?: string;
  cards: Card[];
  collections: Collection[];
  study_logs: StudyLog[];
  last_modified?: string | null;
}): Promise<{ status: string; received: Record<string, number>; id_map?: Record<string, Record<string, number>> }> {
  return request(`${API_PREFIX}/admin/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function listCollections(userId = "me"): Promise<Collection[]> {
  const url = new URL(`${API_PREFIX}/collections/`);
  url.searchParams.set("user_id", userId);
  return request<Collection[]>(url.toString());
}

export async function createCollection(
  payload: { name: string; description: string },
  userId = "me"
): Promise<Collection> {
  const url = new URL(`${API_PREFIX}/collections/`);
  url.searchParams.set("user_id", userId);
  return request<Collection>(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateCollection(
  collectionId: number,
  payload: { name?: string; description?: string },
  userId = "me"
): Promise<Collection> {
  const url = new URL(`${API_PREFIX}/collections/${collectionId}`);
  url.searchParams.set("user_id", userId);
  return request<Collection>(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteCollection(
  collectionId: number,
  userId = "me"
): Promise<{ status: string }> {
  const url = new URL(`${API_PREFIX}/collections/${collectionId}`);
  url.searchParams.set("user_id", userId);
  return request<{ status: string }>(url.toString(), {
    method: "DELETE"
  });
}

export async function searchCards(params: {
  collection?: number;
  query?: string;
  userId?: string;
}): Promise<Card[]> {
  const url = new URL(`${API_PREFIX}/cards/`);
  if (params.collection !== undefined) {
    url.searchParams.set("collection", String(params.collection));
  }
  if (params.query) {
    url.searchParams.set("query", params.query);
  }
  url.searchParams.set("user_id", params.userId ?? "me");
  return request<Card[]>(url.toString());
}

export async function createCard(
  payload: {
    simplified: string;
    pinyin?: string;
    meanings?: string[];
    examples?: string[];
    tags?: string[];
    created_from_dict_id?: number | null;
    collection_ids?: number[];
  },
  userId = "me"
): Promise<Card> {
  const url = new URL(`${API_PREFIX}/cards/`);
  url.searchParams.set("user_id", userId);
  return request<Card>(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateCard(
  cardId: number,
  payload: {
    simplified?: string;
    pinyin?: string;
    meanings?: string[];
    examples?: string[];
    tags?: string[];
    collection_ids?: number[];
  },
  userId = "me"
): Promise<Card> {
  const url = new URL(`${API_PREFIX}/cards/${cardId}`);
  url.searchParams.set("user_id", userId);
  return request<Card>(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteCard(
  cardId: number,
  userId = "me"
): Promise<{ status: string }> {
  const url = new URL(`${API_PREFIX}/cards/${cardId}`);
  url.searchParams.set("user_id", userId);
  return request<{ status: string }>(url.toString(), {
    method: "DELETE"
  });
}

export async function getSchedule(params?: {
  userId?: string;
  n?: number;
}): Promise<StudySchedule> {
  const url = new URL(`${API_PREFIX}/study/schedule`);
  url.searchParams.set("user_id", params?.userId ?? "me");
  if (params?.n) {
    url.searchParams.set("n", String(params.n));
  }
  return request<StudySchedule>(url.toString());
}

export async function submitStudyResponse(payload: {
  card_id: number;
  q: number;
  response_time_ms: number;
  user_id?: string;
}): Promise<StudyResponse> {
  return request<StudyResponse>(`${API_PREFIX}/study/response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function uploadImportFile(file: File): Promise<{
  file_id: string;
  filename: string;
  path: string;
  size: number;
}> {
  const form = new FormData();
  form.append("file", file);
  return request(`${API_PREFIX}/admin/import/upload`, {
    method: "POST",
    body: form
  });
}

export async function triggerImport(payload: {
  file_id: string;
  file_type: "cedict" | "csv";
  csv_mapping?: Record<string, string>;
  pinyin_style: "numbers" | "diacritics" | "none";
  dedupe: boolean;
  replace: boolean;
}): Promise<{ job_id: string; status: string }> {
  return request(`${API_PREFIX}/admin/import/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getImportStatus(jobId: string): Promise<ImportJob> {
  return request(`${API_PREFIX}/admin/import/status/${jobId}`);
}
