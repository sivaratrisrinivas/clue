import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryBoardStateStore,
  type BoardStateStore,
} from "../src/board-state";

const mocks = vi.hoisted(() => ({
  store: undefined as BoardStateStore | undefined,
}));

vi.mock("../src/server-board-store", () => ({
  createServerBoardStateStore: async () => {
    if (!mocks.store) {
      throw new Error("Test store was not configured");
    }

    return mocks.store;
  },
}));

describe("String route", () => {
  it("creates a manual String and returns the refreshed board", async () => {
    const { POST } = await import("../src/app/api/strings/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin("Lucky Star receipt at 12:43 AM");

    const response = await POST(
      new Request("https://clue.test/api/strings", {
        method: "POST",
        body: JSON.stringify({
          fromPinId: firstPin.id,
          toPinId: secondPin.id,
        }),
      }),
    );
    const board = await response.json();

    expect(response.status).toBe(201);
    expect(board.strings).toEqual([
      expect.objectContaining({
        fromPinId: firstPin.id,
        toPinId: secondPin.id,
        kind: "manual",
        source: "manual",
        clueType: "manual_connection",
        stroke: "blue_dashed",
      }),
    ]);
  });
});
