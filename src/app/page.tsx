import React from "react";

import { createBoardStateStore } from "../board-state-source";

export default async function Home() {
  const databaseUrl = process.env.DATABASE_URL;
  const createExecutor = databaseUrl
    ? (await import("../neon-executor")).createNeonQueryExecutor
    : undefined;
  const board = await createBoardStateStore({
    databaseUrl,
    createExecutor,
  }).getCanonicalMysteryBoard();

  return (
    <main aria-label="Mystery board" className="board-shell">
      <section aria-label="Empty board" className="board-plane">
        <header className="board-toolbar">
          <div className="window-mark" aria-hidden="true" />
          <p className="app-name">Clue</p>
          <p className="restore-status">
            <span aria-hidden="true" />
            Board state restored
          </p>
        </header>

        <div className="mystery-heading">
          <h1>{board.mystery.title}</h1>
        </div>

        <div className="empty-board-note">
          <div className="empty-pin-outline" aria-hidden="true" />
          <p>No Pins yet</p>
        </div>
      </section>
    </main>
  );
}
