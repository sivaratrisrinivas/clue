# Clue

Clue is an investigation board that makes memory visible.

The current app opens directly to one Mystery:

> What happened at the party?

## What it does

Clue gives an investigator a full-screen board for collecting evidence. The board loads the canonical Mystery, restores durable board state, and lets the investigator add text-only Pins. A Pin appears immediately, enters a visible remembering state, and then either becomes ready for connection work or shows a retryable memory failure.

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
- `src/app/board.tsx` renders the Pin composer and visible Pins.
- `src/app/api/pins/route.ts` saves text-only Pins before memory work starts.
- `src/app/api/pins/[pinId]/remember/route.ts` runs server-side remembering and preserves saved Pins on failure.
- `src/board-state.ts` defines the board-state interface.
- `src/board-state-source.ts` chooses the data source.
- `src/neon-executor.ts` connects to Neon when `DATABASE_URL` is set.
- `migrations/0001_board_state.sql` creates the four app-owned tables.
- `src/cognee-memory.ts` calls Cognee's server-side REST remember endpoint when Cognee credentials are configured.
- Tests cover the board loader, Pin creation, memory failure behavior, schema boundary, browser boundary, and Cognee server-side boundary.

Without `DATABASE_URL`, the app uses an in-memory board store so the UI can still run locally. With `DATABASE_URL`, it uses Neon for board state.

## Issue 3 status

Issue #3 is implemented for the app-owned flow:

- Text-only Pins can be added from the board.
- Pins are saved immediately before memory work runs.
- Pins persist through the board-state store with position, deletion state, memory status, timestamps, and events.
- The UI shows the Pin while memory work is in progress.
- Failed memory work preserves the Pin and exposes a retry action.
- The browser does not expose Cognee credentials or call Cognee directly.
- The app does not fabricate fallback Clues or Strings when Cognee fails.

The remaining Cognee-specific caveat is live execution against Cognee Cloud. `src/cognee-memory.ts` is wired to Cognee's documented REST API (`POST /api/v1/remember` with `X-Api-Key`), but live success depends on valid `COGNEE_API_KEY`/`COGNEE_SERVICE_URL` values or a local Cognee HTTP service. The current Cognee Cloud account is waitlisted/at capacity, so the app correctly exercises the retryable memory failure path until Cognee API access is available.

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

Copy the example environment file:

```bash
cp .env.example .env.local
```

To use Neon-backed board state, set `DATABASE_URL` in `.env.local`:

```bash
DATABASE_URL=postgres://...
```

Then apply the app-owned board-state migration:

```bash
npm run db:migrate
```

To use Cognee from the server-side Pin remembering route, set:

```bash
COGNEE_API_KEY=...
COGNEE_SERVICE_URL=https://api.cognee.ai
```

`COGNEE_SERVICE_URL` can point at Cognee Cloud or a local Cognee HTTP service. Cognee credentials must remain server-side and must not use a `NEXT_PUBLIC_` prefix.
