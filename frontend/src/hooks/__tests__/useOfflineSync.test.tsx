import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { useOfflineSync } from "../useOfflineSync";

const mockUser = {
  user: {
    id: 1,
    username: "demo",
    settings: {}
  },
  collections: [],
  cards: [],
  study_logs: [],
  last_modified: new Date().toISOString()
};

function TestComponent() {
  const { loading, userData } = useOfflineSync();
  return <div>{loading ? "loading" : userData.user.username}</div>;
}

it("hydrates from API when online", async () => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockUser), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    )
  );

  render(<TestComponent />);

  await waitFor(() => {
    expect(screen.getByText("demo")).toBeInTheDocument();
  });
});
