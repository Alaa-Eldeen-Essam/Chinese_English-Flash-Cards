import React, { useEffect, useMemo, useState } from "react";

import ProgressBar from "../components/ProgressBar";
import { getImportStatus, triggerImport, uploadImportFile } from "../api/client";
import { useAppStore } from "../store/AppStore";
import type { ImportJob } from "../types";

const LEVELS = [1, 2, 3, 4, 5, 6];

export default function Import(): JSX.Element {
  const { userData } = useAppStore();
  const [selected, setSelected] = useState<number[]>([1, 2]);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

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
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    if (downloading) {
      timer = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (timer) {
              window.clearInterval(timer);
            }
            setDownloading(false);
            return 100;
          }
          return prev + 4;
        });
      }, 300);
    }
    return () => {
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [downloading]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const updated = await getImportStatus(job.job_id);
        setJob(updated);
      } catch (error) {
        setStatus("Unable to reach import status endpoint.");
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job]);

  function toggleLevel(level: number) {
    setSelected((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
    );
  }

  function startDownload() {
    setProgress(0);
    setDownloading(true);
  }

  async function handleUpload() {
    if (!file) {
      return;
    }
    setStatus("Uploading...");
    try {
      const result = await uploadImportFile(file);
      setFileId(result.file_id);
      setStatus(`Uploaded: ${result.filename}`);
    } catch (error) {
      setStatus("Upload failed. Check backend connection.");
    }
  }

  async function handleTriggerImport() {
    if (!fileId) {
      setStatus("Upload a file before importing.");
      return;
    }
    setStatus("Import started...");
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
      setStatus("Import failed to start. Check backend connection.");
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

      <div className="panel-grid">
        <div className="panel">
          <h2>Dataset selection</h2>
          <p className="muted">CC-CEDICT (~20MB) plus optional HSK levels.</p>
          <div className="checkbox-grid">
            {LEVELS.map((level) => (
              <label key={level} className="checkbox">
                <input
                  type="checkbox"
                  checked={selected.includes(level)}
                  onChange={() => toggleLevel(level)}
                />
                HSK {level}
              </label>
            ))}
          </div>
          <button className="primary" onClick={startDownload} disabled={downloading}>
            {downloading ? "Downloading..." : "Download datasets"}
          </button>
          <p className="muted">
            Estimated time: {selected.length * 2 + 4} minutes on slow networks.
          </p>
        </div>
        <div className="panel">
          <h2>Download status</h2>
          {downloading || progress > 0 ? (
            <>
              <ProgressBar value={progress} />
              <p className="muted">Preparing CC-CEDICT and HSK {selected.join(", ")}</p>
            </>
          ) : (
            <p className="muted">Ready when you are.</p>
          )}
          <p className="muted">
            Hook this UI to `scripts/import_dict.py` or a backend import endpoint.
          </p>
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
            {status && <p className="muted">{status}</p>}
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
