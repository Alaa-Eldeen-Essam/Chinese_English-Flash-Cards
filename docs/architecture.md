# Architecture

## High-level diagram

```
+------------------+          +-----------------------+
|   React PWA      |  REST    |      FastAPI API      |
|  (Vite + TS)     +--------->+  SRS + Imports + Sync |
|  Offline cache   |          |  SQLite (local)       |
+--------+---------+          +-----------+-----------+
         |                                    |
         | IndexedDB / Service Worker         | Optional cloud sync
         v                                    v
+------------------+          +-----------------------+
|  Local Storage   |          | Postgres / Firebase   |
| (cards, reviews) |          | (future)              |
+------------------+          +-----------------------+
```

## Components

- Frontend UI: React components render flashcards and review controls.
- State layer: Context store holds due cards, review actions, and sync hooks.
- API client: centralizes fetch logic and offline retry strategy.
- Backend API: provides CRUD endpoints, review submission, and scheduling logic.
- SRS service: reusable SM-2 scheduler used across endpoints.
- Import pipeline: converts CC-CEDICT/HSK lists into normalized flashcards.
- Offline cache: IndexedDB and service worker caching (Phase 2).
- Sync layer: push/pull with conflict resolution (Phase 3).
