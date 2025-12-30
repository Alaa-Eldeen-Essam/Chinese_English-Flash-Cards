import React, { useEffect, useState } from "react";

import { useAuthStore } from "../store/AuthStore";

export default function Account(): JSX.Element {
  const { user, saveSettings, logout } = useAuthStore();
  const [dailyGoal, setDailyGoal] = useState(20);
  const [toneColors, setToneColors] = useState(true);
  const [autoTts, setAutoTts] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    const settings = user.settings ?? {};
    const storedGoal = Number(settings["daily_goal"]);
    setDailyGoal(Number.isFinite(storedGoal) ? storedGoal : 20);
    setToneColors(settings["tone_colors"] !== false);
    setAutoTts(settings["auto_tts"] === true);
  }, [user]);

  if (!user) {
    return (
      <section className="page">
        <div className="panel empty">Sign in to manage your profile.</div>
      </section>
    );
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      await saveSettings({
        ...user.settings,
        daily_goal: dailyGoal,
        tone_colors: toneColors,
        auto_tts: autoTts
      });
      setStatus("Settings saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save settings";
      setStatus(message);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Account</h1>
          <p>Manage your profile and study preferences.</p>
        </div>
        <button className="secondary" onClick={() => logout()}>
          Sign out
        </button>
      </header>

      <div className="panel">
        <h2>Profile</h2>
        <div className="inline-meta">
          <span>Username: {user.username}</span>
          <span>Email: {user.email ?? "Not set"}</span>
          <span>Provider: {user.auth_provider}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Study settings</h2>
        <form className="form" onSubmit={handleSave}>
          <label>
            Daily review goal
            <input
              type="number"
              min={5}
              max={200}
              value={dailyGoal}
              onChange={(event) => setDailyGoal(Number(event.target.value))}
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={toneColors}
              onChange={(event) => setToneColors(event.target.checked)}
            />
            Use tone coloring in study views
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoTts}
              onChange={(event) => setAutoTts(event.target.checked)}
            />
            Auto-play audio for each new card
          </label>

          {status && <div className="status-pill">{status}</div>}

          <button className="primary" type="submit">
            Save settings
          </button>
        </form>
      </div>
    </section>
  );
}
