import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryBoardStateStore,
  type BoardStateStore,
} from "../src/board-state";

const mocks = vi.hoisted(() => ({
  store: undefined as BoardStateStore | undefined,
  reconsiderBoardWithCognee: vi.fn(),
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
  reconsiderBoardWithCognee: mocks.reconsiderBoardWithCognee,
}));

describe("Reconsider Board route", () => {
  it("persists defensible new Cognee Strings for the current Mystery board", async () => {
    const { POST } = await import("../src/app/api/reconsider-board/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin(
      "Lucky Star receipt printed at 12:43 AM",
    );
    await mocks.store.markPinReadyForConnection(firstPin.id);
    await mocks.store.markPinReadyForConnection(secondPin.id);
    mocks.reconsiderBoardWithCognee.mockResolvedValueOnce([
      {
        fromPinId: firstPin.id,
        toPinId: secondPin.id,
        clueType: "temporal_proximity",
        confidence: 0.87,
        explanation:
          "Cognee recalled both Pins in the same late-night window.",
        recalledMemory:
          "Kim leaving around midnight is close to the Lucky Star receipt.",
      },
    ]);

    const response = await POST(
      new Request("https://clue.test/api/reconsider-board", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.reconsiderBoardWithCognee).toHaveBeenCalledWith(
      expect.objectContaining({
        mystery: expect.objectContaining({ id: "canonical-party-mystery" }),
        pins: expect.arrayContaining([
          expect.objectContaining({ id: firstPin.id }),
          expect.objectContaining({ id: secondPin.id }),
        ]),
      }),
    );
    expect(body.reconsiderBoard).toEqual({ newStringCount: 1 });
    expect(body.board.strings).toEqual([
      expect.objectContaining({
        fromPinId: firstPin.id,
        toPinId: secondPin.id,
        source: "cognee",
        stroke: "red_solid",
        clueType: "temporal_proximity",
        explanation:
          "Cognee recalled both Pins in the same late-night window.",
      }),
    ]);
  });

  it("returns an honest no-new-Clues state when Cognee finds no defensible Strings", async () => {
    const { POST } = await import("../src/app/api/reconsider-board/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin("A neighbor saw a blue sedan");
    await mocks.store.markPinReadyForConnection(firstPin.id);
    await mocks.store.markPinReadyForConnection(secondPin.id);
    mocks.reconsiderBoardWithCognee.mockResolvedValueOnce([]);

    const response = await POST(
      new Request("https://clue.test/api/reconsider-board", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reconsiderBoard).toEqual({
      newStringCount: 0,
      message: "No new Clues yet.",
    });
    expect(body.board.strings).toEqual([]);
  });

  it("does not duplicate an already visible Cognee String during reconsideration", async () => {
    const { POST } = await import("../src/app/api/reconsider-board/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin(
      "Lucky Star receipt printed at 12:43 AM",
    );
    await mocks.store.addDiscoveredString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      clueType: "temporal_proximity",
      confidence: 0.84,
      explanation: "Cognee already recalled the late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near.",
    });
    mocks.reconsiderBoardWithCognee.mockResolvedValueOnce([
      {
        fromPinId: secondPin.id,
        toPinId: firstPin.id,
        clueType: "temporal_proximity",
        confidence: 0.9,
        explanation:
          "Cognee recalled both Pins in the same late-night window again.",
        recalledMemory:
          "Kim leaving around midnight is close to the Lucky Star receipt.",
      },
    ]);

    const response = await POST(
      new Request("https://clue.test/api/reconsider-board", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reconsiderBoard).toEqual({
      newStringCount: 0,
      message: "No new Clues yet.",
    });
    expect(body.board.strings).toHaveLength(1);
  });
});
