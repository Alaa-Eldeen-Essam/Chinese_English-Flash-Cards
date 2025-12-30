import React from "react";

import type { PageId } from "../pages/pageTypes";

const NAV_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "study", label: "Study" },
  { id: "collections", label: "Collections" },
  { id: "card-editor", label: "Card Editor" },
  { id: "import", label: "Import" },
  { id: "account", label: "Account" }
];

type NavBarProps = {
  active: PageId;
  onNavigate: (page: PageId) => void;
  isOnline: boolean;
  queueCount: number;
  loading: boolean;
  userName: string | null;
  onLogout: () => void;
};

export default function NavBar({
  active,
  onNavigate,
  isOnline,
  queueCount,
  loading,
  userName,
  onLogout
}: NavBarProps): JSX.Element {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="brand-mark">SC</span>
        <div>
          <div className="brand-title">Simplified Chinese Flashcards</div>
          <div className="brand-subtitle">Offline-first study lab</div>
        </div>
      </div>

      <div className="nav-links">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? "nav-link active" : "nav-link"}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="nav-status">
        {userName && <span className="status-pill">Signed in as {userName}</span>}
        <span className={isOnline ? "status-pill online" : "status-pill offline"}>
          {isOnline ? "Online" : "Offline"}
        </span>
        <span className="status-pill">Queue {queueCount}</span>
        {loading && <span className="status-pill">Syncing</span>}
        <button className="secondary" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
