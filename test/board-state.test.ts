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
    });
    expect(queries.join("\n")).toContain("insert into mysteries");
    expect(queries.join("\n")).toContain("from pins");
    expect(queries.join("\n")).toContain("from strings");
  });
});
