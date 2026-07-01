import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryBoardStateStore,
  type BoardStateStore,
} from "../src/board-state";

const mocks = vi.hoisted(() => ({
  store: undefined as BoardStateStore | undefined,
  rememberPinWithCognee: vi.fn(),
}));

vi.mock("../src/server-board-store", () => ({
  createServerBoardStateStore: async () => {
    if (!mocks.store) {
      throw new Error("Test store was not configured");
    }

    return mocks.store;
  },
}));

vi.mock("../src/cognee-memory", () => ({
  rememberPinWithCognee: mocks.rememberPinWithCognee,
}));

describe("Pin remember route", () => {
  it("persists defensible Cognee-discovered Strings and returns the refreshed board", async () => {
    const { POST } = await import("../src/app/api/pins/[pinId]/remember/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin(
      "Lucky Star receipt printed at 12:43 AM",
    );
    mocks.rememberPinWithCognee.mockResolvedValueOnce([
      {
        fromPinId: firstPin.id,
        toPinId: secondPin.id,
        clueType: "temporal_proximity",
        confidence: 0.88,
        explanation:
          "Cognee recalled both Pins in the same late-night time window.",
        recalledMemory:
          "Kim leaving and the Lucky Star receipt were close in time.",
      },
    ]);

    const response = await POST(new Request("https://clue.test"), {
      params: Promise.resolve({ pinId: firstPin.id }),
    });
    const board = await response.json();

    expect(response.status).toBe(200);
    expect(board.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstPin.id,
          memoryStatus: "ready_for_connection",
        }),
      ]),
    );
    expect(board.strings).toEqual([
      expect.objectContaining({
        fromPinId: firstPin.id,
        toPinId: secondPin.id,
        kind: "discovered",
        source: "cognee",
        clueType: "temporal_proximity",
        confidence: 0.88,
        stroke: "red_solid",
        explanation:
          "Cognee recalled both Pins in the same late-night time window.",
      }),
    ]);
  });

  it("does not persist a visible String when Cognee returns no defensible Clues", async () => {
    const { POST } = await import("../src/app/api/pins/[pinId]/remember/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    await mocks.store.addTextPin("Unrelated grocery receipt from last week");
    mocks.rememberPinWithCognee.mockResolvedValueOnce([]);

    const response = await POST(new Request("https://clue.test"), {
      params: Promise.resolve({ pinId: firstPin.id }),
    });
    const board = await response.json();

    expect(response.status).toBe(200);
    expect(board.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstPin.id,
          memoryStatus: "ready_for_connection",
        }),
      ]),
    );
    expect(board.strings).toEqual([]);
    expect(board.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "string.discovered" }),
      ]),
    );
  });
});
