import { describe, expect, it } from "vitest";

import {
  CANONICAL_MYSTERY_TITLE,
  createNeonBoardStateStore,
  createInMemoryBoardStateStore,
} from "../src/board-state";

describe("board state", () => {
  it("loads the canonical Mystery as a durable empty board", async () => {
    const store = createInMemoryBoardStateStore();

    const firstLoad = await store.getCanonicalMysteryBoard();
    const refreshedLoad = await store.getCanonicalMysteryBoard();

    expect(firstLoad.mystery.title).toBe(CANONICAL_MYSTERY_TITLE);
    expect(firstLoad.pins).toEqual([]);
    expect(firstLoad.strings).toEqual([]);
    expect(refreshedLoad).toEqual(firstLoad);
  });

  it("adds a text-only Pin immediately in a remembering state", async () => {
    const store = createInMemoryBoardStateStore();

    const savedPin = await store.addTextPin("Kim left around midnight");
    const board = await store.getCanonicalMysteryBoard();

    expect(savedPin).toMatchObject({
      mysteryId: "canonical-party-mystery",
      text: "Kim left around midnight",
      memoryStatus: "remembering",
      deletedAt: null,
    });
    expect(board.pins).toHaveLength(1);
    expect(board.pins[0]).toEqual(savedPin);
    expect(board.events).toEqual([
      expect.objectContaining({
        name: "pin.created",
        payload: { pinId: savedPin.id },
      }),
    ]);
  });

  it("keeps a saved Pin and does not invent Strings when memory fails", async () => {
    const store = createInMemoryBoardStateStore();
    const savedPin = await store.addTextPin("Lucky Star receipt at 12:43 AM");

    const failedPin = await store.markPinMemoryFailed(
      savedPin.id,
      "Cognee memory is unavailable. Retry when it is configured.",
    );
    const board = await store.getCanonicalMysteryBoard();

    expect(failedPin).toMatchObject({
      id: savedPin.id,
      memoryStatus: "memory_failed",
      memoryError: "Cognee memory is unavailable. Retry when it is configured.",
    });
    expect(board.pins).toEqual([failedPin]);
    expect(board.strings).toEqual([]);
    expect(board.events.map((event) => event.name)).toEqual([
      "pin.created",
      "pin.memory_failed",
    ]);
  });

  it("loads the canonical Mystery board through a Neon query executor", async () => {
    const queries: string[] = [];
    const store = createNeonBoardStateStore({
      async query(text) {
        queries.push(text);

        if (text.includes("from mysteries")) {
          return [
            {
              id: "canonical-party-mystery",
              title: CANONICAL_MYSTERY_TITLE,
            },
          ];
        }

        return [];
      },
    });

    const board = await store.getCanonicalMysteryBoard();

    expect(board).toEqual({
      mystery: {
        id: "canonical-party-mystery",
        title: CANONICAL_MYSTERY_TITLE,
      },
      pins: [],
      strings: [],
      events: [],
    });
    expect(queries.join("\n")).toContain("insert into mysteries");
    expect(queries.join("\n")).toContain("from pins");
    expect(queries.join("\n")).toContain("from strings");
  });
});
