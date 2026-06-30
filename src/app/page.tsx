import React from "react";

import { Board } from "./board";
import { createServerBoardStateStore } from "../server-board-store";

export default async function Home() {
  const store = await createServerBoardStateStore();
  const board = await store.getCanonicalMysteryBoard();

  return (
    <main aria-label="Mystery board" className="board-shell">
      <Board initialBoard={{ ...board, events: [] }} />
    </main>
  );
}
