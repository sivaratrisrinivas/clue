import React from "react";

import { Board } from "./board";
import { createSyntheticDemoRound } from "../demo-round";

export default function Home() {
  const { board } = createSyntheticDemoRound();

  return (
    <main aria-label="Mystery board" className="board-shell">
      <Board initialBoard={{ ...board, events: [] }} />
    </main>
  );
}
