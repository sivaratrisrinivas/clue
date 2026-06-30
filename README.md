# Clue

Clue is an investigation board that makes memory visible.

The current app opens directly to one Mystery:

> What happened at the party?

## What it does

Clue gives an investigator a full-screen board for collecting evidence. In this first slice, the board loads the canonical Mystery, restores the empty board state, and shows a calm starting surface with no login, landing page, team setup, or extra navigation.

The app owns the board state:

- Mysteries
- Pins
- Strings
- Events

Cognee is reserved for memory and retrieval work. Clue does not store entities, embeddings, graph nodes, or semantic relationships in Postgres.

## Why it exists

Investigators often collect facts faster than they can see how those facts connect. Clue is meant to turn memory into something visible on the board. Later slices will add Pins, Cognee-backed remembering, and visible Strings between related Pins.

The short version:

> Cognee is the memory graph behind the Strings. Clue is the board that makes that memory visible.

## How it works

This repo is a Next.js app.

- The home page renders the Mystery board.
- `src/board-state.ts` defines the board-state interface.
- `src/board-state-source.ts` chooses the data source.
- `src/neon-executor.ts` connects to Neon when `DATABASE_URL` is set.
- `migrations/0001_board_state.sql` creates the four app-owned tables.
- Tests cover the board loader, schema boundary, browser boundary, and first board screen.

Without `DATABASE_URL`, the app uses an in-memory board store so the UI can still run locally. With `DATABASE_URL`, it uses Neon for board state.

## Run it locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run checks:

```bash
npm test
npm run build
```

## Environment

To use Neon-backed board state, set:

```bash
DATABASE_URL=postgres://...
```

Cognee credentials are not used in this first board-foundation slice and must not be exposed to the browser.
