import React, { useState } from "react";

import { useAuthStore } from "../store/AuthStore";

type AuthMode = "login" | "register";

export default function Auth(): JSX.Element {
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, email || undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setStatus(message);
    }
  };

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div className="auth-header">
          <div className="brand-mark">SC</div>
          <div>
            <h1>Simplified Chinese Flashcards</h1>
            <p>Sign in to sync your study data across devices.</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "nav-link active" : "nav-link"}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "nav-link active" : "nav-link"}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          {mode === "register" && (
            <label>
              Email (optional)
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {status && <div className="status-pill offline">{status}</div>}

          <button className="primary" type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-footer">
          <span className="muted">Google sign-in available once OAuth is configured.</span>
        </div>
      </div>
    </section>
  );
}
