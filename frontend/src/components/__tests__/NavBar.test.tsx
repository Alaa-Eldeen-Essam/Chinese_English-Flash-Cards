import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import NavBar from "../NavBar";

it("renders navigation and status pills", () => {
  render(
    <NavBar
      active="home"
      onNavigate={() => undefined}
      isOnline={true}
      queueCount={2}
      loading={false}
    />
  );

  expect(screen.getByText("Simplified Chinese Flashcards")).toBeInTheDocument();
  expect(screen.getByText("Home")).toBeInTheDocument();
  expect(screen.getByText("Queue 2")).toBeInTheDocument();
});
