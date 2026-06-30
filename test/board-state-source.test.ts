import { describe, expect, it } from "vitest";

import {
  CANONICAL_MYSTERY_TITLE,
  createBoardStateStore,
} from "../src/board-state-source";

describe("board state source", () => {
  it("uses Neon when a database URL is configured", async () => {
    const store = createBoardStateStore({
      databaseUrl: "postgres://example.test/clue",
      createExecutor() {
        return {
          async query(text) {
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
        };
      },
    });

    await expect(store.getCanonicalMysteryBoard()).resolves.toMatchObject({
      mystery: { title: CANONICAL_MYSTERY_TITLE },
      pins: [],
      strings: [],
    });
  });
});
