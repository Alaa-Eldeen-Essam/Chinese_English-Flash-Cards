import React, { useEffect, useMemo, useState } from "react";

import ProgressBar from "../components/ProgressBar";
import {
  fetchDatasetCatalog,
  fetchDatasetPack,
  getDatasetSelection,
  getImportStatus,
  triggerImport,
  updateDatasetSelection,
  uploadImportFile
} from "../api/client";
import { useAppStore } from "../store/AppStore";
import type { DatasetInfo, DatasetMeta, ImportJob } from "../types";
import {
  clearDatasetEntries,
  getDatasetMeta,
  setDatasetMeta,
  storeDatasetEntries
} from "../utils/indexedDb";

export default function Import(): JSX.Element {
  const { userData, updateUserData, isOnline } = useAppStore();
  const [catalog, setCatalog] = useState<DatasetInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloadState, setDownloadState] = useState<Record<string, DatasetMeta>>({});
  const [downloading, setDownloading] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"cedict" | "csv">("cedict");
  type CsvMapping = {
    simplified: string;
    traditional: string;
    pinyin: string;
    meanings: string;
    examples: string;
    tags: string;
    hsk_level: string;
    frequency: string;
    part_of_speech: string;
  };

  const [mapping, setMapping] = useState<CsvMapping>({
    simplified: "simplified",
    traditional: "traditional",
    pinyin: "pinyin",
    meanings: "meanings",
    examples: "examples",
    tags: "tags",
    hsk_level: "hsk_level",
    frequency: "frequency",
    part_of_speech: "pos"
  });
  const [pinyinStyle, setPinyinStyle] = useState<"numbers" | "diacritics" | "none">(
    "numbers"
  );
  const [dedupe, setDedupe] = useState(true);
  const [replace, setReplace] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const hasDownloadedDatasets = useMemo(
    () =>
      Object.values(downloadState).some(
        (meta) => meta.status === "done" && meta.downloaded > 0
      ),
    [downloadState]
  );

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const datasets = await fetchDatasetCatalog();
        if (active) {
          setCatalog(datasets);
        }
      } catch {
        if (active) {
          setDatasetStatus("Unable to load dataset catalog.");
        }
      }
    }

    async function loadSelection() {
      try {
        const selection = await getDatasetSelection();
        if (active) {
          setSelected(selection.selected);
        }
      } catch {
        // Keep local selection while offline.
      }
    }

    async function loadDownloadState() {
      try {
        const meta = await getDatasetMeta();
        if (!active) {
          return;
        }
        const mapped: Record<string, DatasetMeta> = {};
        meta.forEach((item) => {
          mapped[item.dataset_id] = item;
        });
        setDownloadState(mapped);
      } catch {
        // Ignore IDB errors.
      }
    }

    void loadCatalog();
    void loadSelection();
    void loadDownloadState();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selected.length > 0) {
      return;
    }
    const localSettings = userData.user.settings;
    const localDatasets =
      typeof localSettings === "object" && localSettings !== null
        ? (localSettings as Record<string, unknown>).datasets
        : undefined;
    const localSelected = Array.isArray((localDatasets as { selected?: unknown })?.selected)
      ? ((localDatasets as { selected?: string[] }).selected ?? [])
      : [];
    if (localSelected.length > 0) {
      setSelected(localSelected);
    }
  }, [selected.length, userData.user.settings]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const updated = await getImportStatus(job.job_id);
        setJob(updated);
      } catch (error) {
        setImportStatus("Unable to reach import status endpoint.");
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job]);

  function toggleDataset(datasetId: string) {
    setSelected((prev) =>
      prev.includes(datasetId)
        ? prev.filter((item) => item !== datasetId)
        : [...prev, datasetId]
    );
  }

  async function handleSaveSelection() {
    setDatasetStatus(null);
    const localSelection = {
      selected,
      updated_at: new Date().toISOString()
    };
    const currentSettings =
      typeof userData.user.settings === "object" && userData.user.settings !== null
        ? userData.user.settings
        : {};
    const nextSettings = {
      ...currentSettings,
      datasets: localSelection
    };
    updateUserData({
      ...userData,
      user: {
        ...userData.user,
        settings: nextSettings
      }
    });

    try {
      await updateDatasetSelection(selected);
      setDatasetStatus("Selection saved.");
    } catch (error) {
      setDatasetStatus("Saved locally. Sync when online.");
    }
  }

  async function downloadDataset(dataset: DatasetInfo) {
    if (dataset.status !== "available") {
      return;
    }
    const pageSize = dataset.id === "cedict" ? 1000 : 500;
    const now = new Date().toISOString();
    const meta: DatasetMeta = {
      dataset_id: dataset.id,
      status: "downloading",
      total: 0,
      downloaded: 0,
      updated_at: now,
      version: dataset.version
    };
    setDownloadState((prev) => ({ ...prev, [dataset.id]: meta }));
    await setDatasetMeta(meta);
    await clearDatasetEntries(dataset.id);

    let offset = 0;
    let total = 0;

    try {
      while (true) {
        const pack = await fetchDatasetPack(dataset.id, offset, pageSize);
        if (offset === 0) {
          total = pack.total;
        }
        if (pack.items.length === 0) {
          break;
        }
        await storeDatasetEntries(dataset.id, pack.items);
        offset += pack.items.length;
        const updatedMeta: DatasetMeta = {
          dataset_id: dataset.id,
          status: "downloading",
          total,
          downloaded: offset,
          updated_at: new Date().toISOString(),
          version: dataset.version
        };
        setDownloadState((prev) => ({ ...prev, [dataset.id]: updatedMeta }));
        await setDatasetMeta(updatedMeta);
        if (offset >= total) {
          break;
        }
      }

      const finalMeta: DatasetMeta = {
        dataset_id: dataset.id,
        status: "done",
        total,
        downloaded: offset,
        updated_at: new Date().toISOString(),
        version: dataset.version
      };
      setDownloadState((prev) => ({ ...prev, [dataset.id]: finalMeta }));
      await setDatasetMeta(finalMeta);
    } catch (error) {
      const errorMeta: DatasetMeta = {
        dataset_id: dataset.id,
        status: "error",
        total,
        downloaded: offset,
        updated_at: new Date().toISOString(),
        version: dataset.version,
        error: "Download failed"
      };
      setDownloadState((prev) => ({ ...prev, [dataset.id]: errorMeta }));
      await setDatasetMeta(errorMeta);
    }
  }

  async function handleDownloadSelected() {
    if (!isOnline) {
      setDatasetStatus("Reconnect to download datasets.");
      return;
    }
    setDatasetStatus(null);
    const available = catalog.filter(
      (dataset) => selected.includes(dataset.id) && dataset.status === "available"
    );
    if (available.length === 0) {
      setDatasetStatus("No available datasets selected.");
      return;
    }
    setDownloading(true);
    for (const dataset of available) {
      await downloadDataset(dataset);
    }
    setDownloading(false);
    setDatasetStatus("Download queue finished.");
  }

  async function handleUpload() {
    if (!file) {
      return;
    }
    setImportStatus("Uploading...");
    try {
      const result = await uploadImportFile(file);
      setFileId(result.file_id);
      setImportStatus(`Uploaded: ${result.filename}`);
    } catch (error) {
      setImportStatus("Upload failed. Check backend connection.");
    }
  }

  async function handleTriggerImport() {
    if (!fileId) {
      setImportStatus("Upload a file before importing.");
      return;
    }
    setImportStatus("Import started...");
    try {
      const response = await triggerImport({
        file_id: fileId,
        file_type: fileType,
        csv_mapping: fileType === "csv" ? mapping : undefined,
        pinyin_style: pinyinStyle,
        dedupe,
        replace
      });
      setJob({
        job_id: response.job_id,
        status: response.status,
        progress: 0,
        logs: [],
        stats: null,
        created_at: new Date().toISOString(),
        finished_at: null
      });
    } catch (error) {
      setImportStatus("Import failed to start. Check backend connection.");
    }
  }

  const logs = useMemo(() => job?.logs ?? [], [job]);
  const mappingEntries = useMemo(
    () => Object.entries(mapping) as Array<[keyof CsvMapping, string]>,
    [mapping]
  );

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Import Dictionary</h1>
          <p>Download curated datasets for offline study.</p>
        </div>
      </header>

      {userData.cards.length === 0 && (
        <div className="panel callout">
          <h2>First run setup</h2>
          <p>
            Grab CC-CEDICT plus HSK levels to unlock dictionary search and smart
            deck building.
          </p>
        </div>
      )}

      {!hasDownloadedDatasets && (
        <div className="panel callout">
          <h2>Dictionary search tips</h2>
          <p>
            For full dictionary coverage, download CC-CEDICT. HSK-only packs are
            smaller but limited to their level lists.
          </p>
        </div>
      )}

      <div className="panel-grid">
        <div className="panel">
          <h2>Dataset catalog</h2>
          <p className="muted">Pick datasets to download and keep available offline.</p>
          {catalog.length > 0 ? (
            <ul className="list selectable">
              {catalog.map((dataset) => {
                const isSelected = selected.includes(dataset.id);
                const disabled = dataset.status !== "available";
                return (
                  <li
                    key={dataset.id}
                    className={isSelected ? "active" : ""}
                  >
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDataset(dataset.id)}
                        disabled={disabled}
                      />
                      <div>
                        <div>{dataset.name}</div>
                        <div className="muted">{dataset.description}</div>
                      </div>
                    </label>
                    <span className="muted">
                      {dataset.size_mb} MB · {dataset.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">Loading datasets...</p>
          )}
          <div className="inline-meta">
            <button className="secondary" onClick={handleSaveSelection}>
              Save selection
            </button>
            <button
              className="primary"
              onClick={handleDownloadSelected}
              disabled={downloading || selected.length === 0}
            >
              {downloading ? "Downloading..." : "Download selected"}
            </button>
          </div>
          {datasetStatus && <p className="muted">{datasetStatus}</p>}
        </div>
        <div className="panel">
          <h2>Download status</h2>
          {Object.keys(downloadState).length > 0 ? (
            <div className="form">
              {Object.values(downloadState).map((meta) => {
                const dataset = catalog.find((item) => item.id === meta.dataset_id);
                const total = meta.total || 0;
                const percent = total > 0 ? Math.round((meta.downloaded / total) * 100) : 0;
                return (
                  <div key={meta.dataset_id}>
                    <div className="inline-meta">
                      <span>{dataset?.name ?? meta.dataset_id}</span>
                      <span>{meta.status}</span>
                      <span>
                        {meta.downloaded}/{total || "?"}
                      </span>
                    </div>
                    <ProgressBar value={percent} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No downloads yet.</p>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Admin import</h2>
          <p className="muted">
            Upload raw CC-CEDICT or CSV files, map columns, and trigger an import job.
          </p>
          <div className="form">
            <label>
              File type
              <select value={fileType} onChange={(event) => setFileType(event.target.value as "cedict" | "csv")}>
                <option value="cedict">CC-CEDICT text or .gz</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label>
              Upload file
              <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="secondary" onClick={handleUpload} disabled={!file}>
              Upload raw file
            </button>
          </div>

          {fileType === "csv" && (
            <div className="form">
              <h3>CSV column mapping</h3>
              <div className="mapping-grid">
                {mappingEntries.map(([key, value]) => (
                  <label key={key}>
                    {key}
                    <input
                      value={value}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form">
            <label>
              Pinyin format
              <select
                value={pinyinStyle}
                onChange={(event) =>
                  setPinyinStyle(event.target.value as "numbers" | "diacritics" | "none")
                }
              >
                <option value="numbers">Tone numbers</option>
                <option value="diacritics">Tone marks</option>
                <option value="none">Leave as-is</option>
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={dedupe} onChange={() => setDedupe((prev) => !prev)} />
              Deduplicate entries
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={replace} onChange={() => setReplace((prev) => !prev)} />
              Replace existing dictionary
            </label>
            <button className="primary" onClick={handleTriggerImport} disabled={!fileId}>
              Trigger import
            </button>
            {importStatus && <p className="muted">{importStatus}</p>}
          </div>
        </div>

        <div className="panel">
          <h2>Import progress</h2>
          {job ? (
            <>
              <ProgressBar value={job.progress} />
              <div className="inline-meta">
                <span>Status: {job.status}</span>
                {job.stats && <span>Inserted: {job.stats.inserted}</span>}
              </div>
              {logs.length > 0 ? (
                <ul className="log-list">
                  {logs.slice(-6).map((log, index) => (
                    <li key={`${log.timestamp}-${index}`}>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`log-${log.level}`}>{log.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Logs will appear while importing.</p>
              )}
            </>
          ) : (
            <p className="muted">No import jobs yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
