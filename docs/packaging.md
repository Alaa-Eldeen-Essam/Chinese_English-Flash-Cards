# Phase 6 - Packaging and Distribution

This guide covers packaging the app as a PWA, desktop app, and mobile app.

## Web (PWA)

PWA assets are in `frontend/public/` and registered in `frontend/src/main.tsx`.

Build and test locally:

```bash
cd frontend
npm install
npm run build
npm run preview
```

Then open the app in the browser and use "Install" to add it to the home screen.

Notes:
- The service worker caches app shell assets after the first load.
- For offline use, users should open the app once while online.

## Desktop (Electron + embedded backend)

Recommended layout:
- `desktop/` (Electron main process and packaging config)
- `frontend/dist/` (built UI)
- `backend/` (FastAPI packaged to a single binary)

Suggested steps:

1) Start Electron in dev mode:

```bash
cd desktop
npm install
npm run dev
```

This starts:
- the backend on `http://127.0.0.1:8000`
- the Vite dev server on `http://localhost:5173`
- Electron pointing at the dev server

2) Build backend binary with PyInstaller:

```bash
pip install pyinstaller
pyinstaller -F -n sc-flashcards-backend backend/app/main.py
```

3) Build the UI:

```bash
cd frontend
npm run build
```

4) Package Electron (example):

```bash
cd desktop
npm install --save-dev electron electron-builder
```

Then add scripts and `electron-builder` config to package Windows/Mac/Linux.

Windows packaging (NSIS + portable) is configured in `desktop/package.json`.

## Release workflow (GitHub Actions)

Tag a release (e.g. `v0.1.0`) to build the Windows installer:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Artifacts are uploaded from `desktop/dist/`.

## Mobile (Expo / React Native)

Scaffold lives in `mobile/`.

```bash
cd mobile
npm install
npm run start
```

You can reuse the API contract and sync logic; replace IndexedDB with
SQLite or AsyncStorage.

## Offline distribution

Option A (recommended):
- Ship a baseline SQLite DB in `backend/data/flashcards.db`
- Include it with the installer
- App uses it on first run

Option B:
- Ship a dataset bundle (CSV/JSON) in `data/packs/`
- On first run, import the pack locally

Recommended layout:

```
data/
  raw/
  packs/
backend/
  data/
    flashcards.db
```

For baseline data:

```bash
python scripts/import_dict.py --download --replace
```

This populates `backend/data/flashcards.db` so it can be shipped with the installer.

To prepare an offline bundle (frontend build + backend binary + baseline DB):

```bash
python scripts/prepare_offline_bundle.py
```
