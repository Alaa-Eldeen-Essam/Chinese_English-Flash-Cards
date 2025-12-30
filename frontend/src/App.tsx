import React, { useEffect, useState } from "react";
import Flashcard from "./components/Flashcard";
import { FlashcardProvider, useFlashcards } from "./state/flashcards";
import { healthCheck } from "./api/client";

function AppContent(): JSX.Element {
  const { currentCard, remainingCount, reviewCard, resetSession } = useFlashcards();
  const [apiStatus, setApiStatus] = useState("Checking backend...");

  useEffect(() => {
    let mounted = true;

    healthCheck()
      .then(() => {
        if (mounted) {
          setApiStatus("Backend online");
        }
      })
      .catch(() => {
        if (mounted) {
          setApiStatus("Offline mode: using local data");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Simplified Chinese Flashcards</h1>
        <div className="status">{apiStatus}</div>
        <div className="status">{remainingCount} cards due</div>
      </header>

      <div className="card-shell">
        {currentCard ? (
          <Flashcard card={currentCard} onRate={reviewCard} />
        ) : (
          <div className="empty">
            <p>No cards due right now. Nice work!</p>
            <button onClick={resetSession}>Reset demo session</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <FlashcardProvider>
      <AppContent />
    </FlashcardProvider>
  );
}
