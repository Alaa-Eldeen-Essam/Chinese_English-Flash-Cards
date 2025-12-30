import React, { useMemo, useState } from "react";

import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Study from "./pages/Study";
import Collections from "./pages/Collections";
import CardEditor from "./pages/CardEditor";
import Import from "./pages/Import";
import type { PageId } from "./pages/pageTypes";
import { AppStoreProvider, useAppStore } from "./store/AppStore";

function AppLayout(): JSX.Element {
  const [page, setPage] = useState<PageId>("home");
  const { isOnline, queue, loading } = useAppStore();

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
      />
      <main className="main">{content}</main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <AppStoreProvider>
      <AppLayout />
    </AppStoreProvider>
  );
}
