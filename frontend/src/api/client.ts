import type {
  AuthResponse,
  AuthUser,
  Card,
  Collection,
  DatasetInfo,
  DatasetPack,
  DatasetSelection,
  DictSearchResponse,
  ImportJob,
  StudyLog,
  StudyResponse,
  StudySchedule,
  UserData
} from "../types";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "../utils/auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const API_PREFIX = `${API_BASE}/api`;

let refreshPromise: Promise<AuthResponse | null> | null = null;

async function refreshAuthTokens(): Promise<AuthResponse | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
      .then(async (response) => {
        if (!response.ok) {
          clearAuthTokens();
          return null;
        }
        const data = (await response.json()) as AuthResponse;
        setAuthTokens(data.token.access_token, data.token.refresh_token);
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  includeAuth = true,
  retryOnAuth = true
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (includeAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && includeAuth && retryOnAuth) {
    const refreshed = await refreshAuthTokens();
    if (refreshed?.token?.access_token) {
      return request<T>(url, options, includeAuth, false);
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function healthCheck(): Promise<{ status: string }> {
  return request(`${API_PREFIX}/admin/health`);
}

export async function registerUser(payload: {
  username: string;
  password: string;
  email?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>(
    `${API_PREFIX}/auth/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    false
  );
}

export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>(
    `${API_PREFIX}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    false
  );
}

export async function refreshSession(): Promise<AuthResponse | null> {
  return refreshAuthTokens();
}

export async function logoutUser(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return;
  }
  await request(
    `${API_PREFIX}/auth/logout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    },
    false
  );
  clearAuthTokens();
}

export async function getGoogleAuthUrl(state?: string): Promise<{ auth_url: string }> {
  const url = new URL(`${API_PREFIX}/auth/google/start`);
  if (state) {
    url.searchParams.set("state", state);
  }
  return request<{ auth_url: string }>(url.toString(), {}, false);
}

export async function exchangeGoogleCode(code: string): Promise<AuthResponse> {
  return request<AuthResponse>(
    `${API_PREFIX}/auth/google/callback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    },
    false
  );
}

export async function getProfile(): Promise<AuthUser> {
  return request<AuthUser>(`${API_PREFIX}/auth/me`);
}

export async function updateSettings(settings: Record<string, unknown>): Promise<AuthUser> {
  return request<AuthUser>(`${API_PREFIX}/auth/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings })
  });
}

export async function fetchUserDump(): Promise<UserData> {
  return request<UserData>(`${API_PREFIX}/admin/dump`);
}

export async function fetchDatasetCatalog(): Promise<DatasetInfo[]> {
  return request<DatasetInfo[]>(`${API_PREFIX}/datasets/catalog`);
}

export async function getDatasetSelection(): Promise<DatasetSelection> {
  return request<DatasetSelection>(`${API_PREFIX}/datasets/selection`);
}

export async function updateDatasetSelection(selected: string[]): Promise<DatasetSelection> {
  return request<DatasetSelection>(`${API_PREFIX}/datasets/selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected })
  });
}

export async function fetchDatasetPack(
  datasetId: string,
  offset = 0,
  limit = 500
): Promise<DatasetPack> {
  const url = new URL(`${API_PREFIX}/datasets/pack`);
  url.searchParams.set("dataset_id", datasetId);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  return request<DatasetPack>(url.toString());
}

export async function searchDictionary(params: {
  query: string;
  mode?: "all" | "simplified" | "traditional" | "pinyin" | "meanings";
  hsk?: string;
  pos?: string;
  freq_min?: number;
  freq_max?: number;
  limit?: number;
  offset?: number;
}): Promise<DictSearchResponse> {
  const url = new URL(`${API_PREFIX}/dict/search`);
  url.searchParams.set("query", params.query);
  if (params.mode) {
    url.searchParams.set("mode", params.mode);
  }
  if (params.hsk) {
    url.searchParams.set("hsk", params.hsk);
  }
  if (params.pos) {
    url.searchParams.set("pos", params.pos);
  }
  if (params.freq_min !== undefined) {
    url.searchParams.set("freq_min", String(params.freq_min));
  }
  if (params.freq_max !== undefined) {
    url.searchParams.set("freq_max", String(params.freq_max));
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }
  return request<DictSearchResponse>(url.toString());
}

export async function syncUserData(payload: {
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

export async function listCollections(): Promise<Collection[]> {
  return request<Collection[]>(`${API_PREFIX}/collections/`);
}

export async function createCollection(
  payload: { name: string; description: string }
): Promise<Collection> {
  return request<Collection>(`${API_PREFIX}/collections/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateCollection(
  collectionId: number,
  payload: { name?: string; description?: string }
): Promise<Collection> {
  return request<Collection>(`${API_PREFIX}/collections/${collectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteCollection(collectionId: number): Promise<{ status: string }> {
  return request<{ status: string }>(`${API_PREFIX}/collections/${collectionId}`, {
    method: "DELETE"
  });
}

export async function searchCards(params: {
  collection?: number;
  query?: string;
}): Promise<Card[]> {
  const url = new URL(`${API_PREFIX}/cards/`);
  if (params.collection !== undefined) {
    url.searchParams.set("collection", String(params.collection));
  }
  if (params.query) {
    url.searchParams.set("query", params.query);
  }
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
  }
): Promise<Card> {
  return request<Card>(`${API_PREFIX}/cards/`, {
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
  }
): Promise<Card> {
  return request<Card>(`${API_PREFIX}/cards/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteCard(cardId: number): Promise<{ status: string }> {
  return request<{ status: string }>(`${API_PREFIX}/cards/${cardId}`, {
    method: "DELETE"
  });
}

export async function getSchedule(params?: { n?: number; collection_id?: number }): Promise<StudySchedule> {
  const url = new URL(`${API_PREFIX}/study/schedule`);
  if (params?.n) {
    url.searchParams.set("n", String(params.n));
  }
  if (params?.collection_id !== undefined) {
    url.searchParams.set("collection_id", String(params.collection_id));
  }
  return request<StudySchedule>(url.toString());
}

export async function submitStudyResponse(payload: {
  card_id: number;
  q: number;
  response_time_ms: number;
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
