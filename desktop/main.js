const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let backendProcess = null;

function toSqliteUrl(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return `sqlite:///${normalized}`;
}

function resolveBackendBinary() {
  const binaryName =
    process.platform === "win32" ? "sc-flashcards-backend.exe" : "sc-flashcards-backend";
  return path.join(process.resourcesPath, "backend", binaryName);
}

function startBackend() {
  const port = process.env.BACKEND_PORT || "8000";
  const backendEnv = {
    ...process.env,
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    CORS_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173,null",
    PYTHONUNBUFFERED: "1"
  };

  if (app.isPackaged) {
    const binaryPath = process.env.BACKEND_BINARY_PATH || resolveBackendBinary();
    const dbPath = path.join(process.resourcesPath, "backend", "data", "flashcards.db");
    backendEnv.DATABASE_URL = toSqliteUrl(dbPath);
    backendProcess = spawn(binaryPath, [], { env: backendEnv, stdio: "inherit" });
    return;
  }

  const backendCwd = path.join(__dirname, "..", "backend");
  const pythonCmd = process.env.BACKEND_PYTHON || "python";
  const args = [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(port)
  ];
  backendProcess = spawn(pythonCmd, args, { cwd: backendCwd, env: backendEnv, stdio: "inherit" });
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }
  backendProcess.kill();
  backendProcess = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (!app.isPackaged && process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    return;
  }

  const indexPath = path.join(process.resourcesPath, "frontend", "dist", "index.html");
  win.loadFile(indexPath);
}

app.on("ready", () => {
  if (process.env.BACKEND_MANAGED !== "false") {
    startBackend();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
