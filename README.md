# Clue

Clue is an investigation board that makes memory visible.

The current app opens directly to one Mystery:

> What happened at the party?

## What it does

Clue gives an investigator a full-screen board for collecting evidence. The board loads the canonical Mystery, restores durable board state, and lets the investigator add text-only Pins. A Pin appears immediately, enters a visible remembering state, then either becomes ready for connection work or shows a retryable memory failure. When Cognee recalls a defensible relationship to another Pin, Clue renders a red solid String with an inspectable explanation.

The app owns the board state:

- Mysteries
- Pins
- Strings
- Events

Cognee is reserved for memory and retrieval work. Clue does not store entities, embeddings, graph nodes, or semantic relationships in Postgres.

## Why it exists

Investigators often collect facts faster than they can see how those facts connect. Clue turns memory into something visible on the board: Pins are remembered by Cognee, then defensible recalled Clues become visible Strings between related Pins.

The short version:

> Cognee is the memory graph behind the Strings. Clue is the board that makes that memory visible.

## How it works

This repo is a Next.js app.

- The home page renders the Mystery board.
- `src/app/board.tsx` renders the Pin composer, visible Pins, Cognee-discovered Strings, and String explanations.
- `src/app/api/pins/route.ts` saves text-only Pins before memory work starts.
- `src/app/api/pins/[pinId]/remember/route.ts` runs server-side remembering, persists defensible Cognee-discovered Strings, and preserves saved Pins on failure.
- `src/board-state.ts` defines the board-state interface.
- `src/board-state-source.ts` chooses the data source.
- `src/neon-executor.ts` connects to Neon when `DATABASE_URL` is set.
- `migrations/0001_board_state.sql` creates the four app-owned tables.
- `migrations/0002_discovered_string_rendering.sql` adds discovered String rendering fields for existing databases.
- `src/cognee-memory.ts` calls Cognee's server-side REST remember and recall endpoints when Cognee credentials are configured.
- Tests cover the board loader, Pin creation, memory failure behavior, Cognee recall filtering, discovered String rendering, schema boundary, browser boundary, and Cognee server-side boundary.

Without `DATABASE_URL`, the app uses an in-memory board store so the UI can still run locally. With `DATABASE_URL`, it uses Neon for board state.

## Issue 3 and 4 status

Issues #3 and #4 are implemented for the app-owned flow:

- Text-only Pins can be added from the board.
- Pins are saved immediately before memory work runs.
- Pins persist through the board-state store with position, deletion state, memory status, timestamps, and events.
- The UI shows the Pin while memory work is in progress.
- Failed memory work preserves the Pin and exposes a retry action.
- The browser does not expose Cognee credentials or call Cognee directly.
- The app does not fabricate fallback Clues or Strings when Cognee fails.
- Server-side Cognee recall can produce defensible Clues for Pins in the current Mystery.
- Cognee-discovered Strings render as red solid Strings between the correct Pins.
- Clicking a String opens an explanation that names both Pins, the Clue Type, and recalled Cognee memory when available.
- Weak, vague, or explanation-free Cognee results are filtered before they render.
- Persisted String state stores rendering data, source, Clue Type, confidence, explanation, timestamps, and app events without duplicating Cognee entities, embeddings, graph nodes, or semantic relationships in Neon.

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
COGNEE_BASE_URL=https://tenant-...aws.cognee.ai
COGNEE_SERVICE_URL=https://api.cognee.ai
```

Cognee Cloud accounts use a tenant base URL. `COGNEE_BASE_URL` wins when both URL variables are set; `COGNEE_SERVICE_URL` remains available for the generic Cloud URL or a local Cognee HTTP service. Cognee credentials must remain server-side and must not use a `NEXT_PUBLIC_` prefix.
