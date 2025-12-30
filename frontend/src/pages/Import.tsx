import React, { useEffect, useState } from "react";

import ProgressBar from "../components/ProgressBar";
import { useAppStore } from "../store/AppStore";

const LEVELS = [1, 2, 3, 4, 5, 6];

export default function Import(): JSX.Element {
  const { userData } = useAppStore();
  const [selected, setSelected] = useState<number[]>([1, 2]);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

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

  function toggleLevel(level: number) {
    setSelected((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
    );
  }

  function startDownload() {
    setProgress(0);
    setDownloading(true);
  }

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
    </section>
  );
}
