import React, { useMemo, useState } from "react";

import NavBar from "./components/NavBar";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Study from "./pages/Study";
import Collections from "./pages/Collections";
import CardEditor from "./pages/CardEditor";
import Import from "./pages/Import";
import Account from "./pages/Account";
import type { PageId } from "./pages/pageTypes";
import { AppStoreProvider, useAppStore } from "./store/AppStore";
import { AuthProvider, useAuthStore } from "./store/AuthStore";

function AppLayout(): JSX.Element {
  const [page, setPage] = useState<PageId>("home");
  const { isOnline, queue, loading } = useAppStore();
  const { user, logout } = useAuthStore();

  const content = useMemo(() => {
    switch (page) {
      case "study":
        return <Study />;
      case "collections":
        return <Collections />;
      case "card-editor":
        return <CardEditor />;
      case "import":
        return <Import />;
      case "account":
        return <Account />;
      case "home":
      default:
        return <Home onNavigate={setPage} />;
    }
  }, [page]);

  return (
    <div className="app-shell">
      <NavBar
        active={page}
        onNavigate={setPage}
        isOnline={isOnline}
        queueCount={queue.length}
        loading={loading}
        userName={user?.username ?? null}
        onLogout={logout}
      />
      <main className="main">{content}</main>
    </div>
  );
}

function AppShell(): JSX.Element {
  const auth = useAuthStore();
  if (auth.loading) {
    return (
      <section className="page">
        <div className="panel empty">Loading your session...</div>
      </section>
    );
  }
  if (!auth.isAuthenticated) {
    return <Auth />;
  }
  return (
    <AppStoreProvider>
      <AppLayout />
    </AppStoreProvider>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
