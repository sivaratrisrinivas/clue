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

describe("Pin route", () => {
  it("moves a Pin and returns the refreshed board", async () => {
    const { PATCH } = await import("../src/app/api/pins/[pinId]/route");
    mocks.store = createInMemoryBoardStateStore();
    const pin = await mocks.store.addTextPin("Kim left around midnight");

    const response = await PATCH(
      new Request("https://clue.test/api/pins/pin-kim-left", {
        method: "PATCH",
        body: JSON.stringify({ x: 360, y: 225 }),
      }),
      { params: Promise.resolve({ pinId: pin.id }) },
    );
    const board = await response.json();

    expect(response.status).toBe(200);
    expect(board.pins).toEqual([
      expect.objectContaining({ id: pin.id, x: 360, y: 225 }),
    ]);
  });

  it("deletes a Pin and returns a board without its visible Strings", async () => {
    const { DELETE } = await import("../src/app/api/pins/[pinId]/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin("Lucky Star receipt at 12:43 AM");
    await mocks.store.addDiscoveredString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      clueType: "temporal_proximity",
      confidence: 0.86,
      explanation: "Cognee recalled both Pins in the same late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near each other.",
    });

    const response = await DELETE(new Request("https://clue.test"), {
      params: Promise.resolve({ pinId: firstPin.id }),
    });
    const board = await response.json();

    expect(response.status).toBe(200);
    expect(board.pins).toEqual([
      expect.objectContaining({ id: secondPin.id }),
    ]);
    expect(board.strings).toEqual([]);
  });
});
