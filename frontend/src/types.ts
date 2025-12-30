export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5;

export type Collection = {
  id: number;
  owner_id: number;
  name: string;
  description: string;
};

export type Card = {
  id: number;
  owner_id: number;
  simplified: string;
  pinyin: string;
  meanings: string[];
  examples: string[];
  tags: string[];
  created_from_dict_id?: number | null;
  easiness: number;
  interval_days: number;
  repetitions: number;
  next_due: string;
};

export type StudyLog = {
  id: number;
  card_id: number;
  user_id: number;
  timestamp: string;
  ease: number;
  correct: boolean;
  response_time_ms: number;
};

export type UserData = {
  user: {
    id: number;
    username: string;
    settings: Record<string, unknown>;
  };
  collections: Collection[];
  cards: Card[];
  study_logs: StudyLog[];
  last_modified: string;
};

export type StudySchedule = {
  generated_at: string;
  count: number;
  cards: Card[];
};

export type StudyResponse = {
  card: Card;
  logged_at: string;
};

export type SyncQueueItem = {
  id: string;
  type: "study" | "create_card" | "create_collection";
  payload: unknown;
  created_at: string;
};

export type ImportLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

export type ImportJob = {
  job_id: string;
  status: string;
  progress: number;
  logs: ImportLogEntry[];
  stats?: {
    parsed: number;
    normalized: number;
    deduped: number;
    inserted: number;
  } | null;
  created_at: string;
  finished_at?: string | null;
};
