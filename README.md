# Simplified Chinese Flashcards

Offline-first flashcard app for Simplified Chinese vocabulary with spaced repetition scheduling. Built as a PWA frontend + FastAPI backend, designed for local-first use with optional sync later.

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

The frontend shows a basic "Hello World" flashcard and can call the backend health endpoint.

## Structure

```
frontend/     # React + Vite PWA
backend/      # FastAPI + SQLite
docs/         # Architecture, API spec, upgrade notes
```

## Phase 1: Setup & Core UI

**Concrete tasks**
1. Bootstrap React + Vite + TypeScript app and FastAPI server.
2. Implement the Flashcard component and a minimal review flow.
3. Add local mock data and a "Hello World" flashcard.
4. Wire a basic API client and health check.
5. Establish lint/format scripts and a basic test harness.

**Code/architecture guidance**
- UI components live in `frontend/src/components/`.
- State management uses a simple Context store in `frontend/src/state/`.
- API clients live in `frontend/src/api/`.
- Backend routes are defined in `backend/app/api/`.

**Example scheduling pseudocode**

```text
if rating < 3:
    repetition = 0
    interval_days = 1
else:
    if repetition == 0:
        interval_days = 1
    elif repetition == 1:
        interval_days = 6
    else:
        interval_days = round(interval_days * ease_factor)
    repetition += 1

# Adjust ease factor
ease_factor = max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))

next_due = today + interval_days
```

**Testing steps**
- Frontend: run `npm test` once a test runner is added (see Phase 2).
- Backend: `poetry run pytest` (tests are stubbed in `backend/tests/`).

## Phase 2: SRS Logic & Offline Storage

**Concrete tasks**
1. Implement SM-2 scheduling in both frontend and backend.
2. Persist flashcards and reviews to SQLite.
3. Add import utilities for CC-CEDICT and HSK lists.
4. Add a service worker and IndexedDB caching for offline use.
5. Expand the API with CRUD and review endpoints.

**Code/architecture guidance**
- SRS logic in `backend/app/services/srs.py` and `frontend/src/utils/srs.ts`.
- Data access in `backend/app/db.py` and SQLAlchemy models in `backend/app/models.py`.
- Import pipeline in `backend/app/services/importer.py`.

**Example scheduling pseudocode**

```text
function schedule(card, rating):
    if rating < 3:
        card.repetition = 0
        card.interval_days = 1
    else:
        if card.repetition == 0: interval_days = 1
        else if card.repetition == 1: interval_days = 6
        else: interval_days = round(card.interval_days * card.ease_factor)
        card.repetition += 1

    card.ease_factor = max(1.3, card.ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))
    card.due_at = today + interval_days
    return card
```

**Testing steps**
- Unit tests for scheduling logic (`backend/tests/test_srs.py`).
- Integration tests for API endpoints (`backend/tests/test_api.py`).

## Phase 3: Sync & AI Hooks

**Concrete tasks**
1. Add change tracking (review logs, last_updated timestamps).
2. Implement a sync layer (push/pull) with a remote database.
3. Add conflict resolution rules (client-wins or timestamp-based).
4. Create an extension point for AI helpers (sentences, TTS).
5. Add a background task queue for batch processing.

**Code/architecture guidance**
- Sync logic in a new `backend/app/services/sync.py`.
- Add a `sync_state` table for checkpoints.
- Use `frontend/src/api/client.ts` to manage retries and offline queues.

**Testing steps**
- Sync tests with mocked remote endpoints.
- Regression tests for offline-first flows and conflict resolution.

## Upgrades & AI Integrations

- Add offline TTS using browser APIs or local engines (e.g., Coqui TTS).
- Generate example sentences with local models (e.g., Llama.cpp) or hosted APIs.
- Add pronunciation scoring by comparing user audio to pinyin tokens.
- Provider notes and links:
  - Hugging Face Inference API limits: https://huggingface.co/docs/api-inference
  - Replicate pricing and quotas: https://replicate.com/pricing
  - Cohere pricing: https://cohere.com/pricing
- Detailed notes: see `docs/upgrade-notes.md`.
