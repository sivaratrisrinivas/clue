import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryBoardStateStore,
  type BoardStateStore,
} from "../src/board-state";

const mocks = vi.hoisted(() => ({
  store: undefined as BoardStateStore | undefined,
  queryBoardWithCognee: vi.fn(),
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
  queryBoardWithCognee: mocks.queryBoardWithCognee,
}));

describe("Board Query route", () => {
  it("answers a bounded time-window Board Query using the current Mystery board", async () => {
    const { POST } = await import("../src/app/api/board-query/route");
    mocks.store = createInMemoryBoardStateStore();
    const firstPin = await mocks.store.addTextPin("Kim left around midnight");
    const secondPin = await mocks.store.addTextPin(
      "Lucky Star receipt printed at 12:43 AM",
    );
    await mocks.store.markPinReadyForConnection(firstPin.id);
    await mocks.store.markPinReadyForConnection(secondPin.id);
    mocks.queryBoardWithCognee.mockResolvedValueOnce({
      answer:
        "Between midnight and 1 AM, Kim left and the Lucky Star receipt was printed at 12:43 AM.",
      groundedPinIds: [firstPin.id, secondPin.id],
      queryKind: "time_window",
    });

    const response = await POST(
      new Request("https://clue.test/api/board-query", {
        method: "POST",
        body: JSON.stringify({
          question: "What happened between midnight and 1 AM?",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.queryBoardWithCognee).toHaveBeenCalledWith(
      "What happened between midnight and 1 AM?",
      expect.objectContaining({
        mystery: expect.objectContaining({ id: "canonical-party-mystery" }),
        pins: expect.arrayContaining([
          expect.objectContaining({ id: firstPin.id }),
          expect.objectContaining({ id: secondPin.id }),
        ]),
      }),
    );
    expect(body).toEqual({
      answer:
        "Between midnight and 1 AM, Kim left and the Lucky Star receipt was printed at 12:43 AM.",
      groundedPinIds: [firstPin.id, secondPin.id],
      queryKind: "time_window",
    });
  });

  it("returns a recoverable failure when Cognee cannot answer a Board Query", async () => {
    const { POST } = await import("../src/app/api/board-query/route");
    mocks.store = createInMemoryBoardStateStore();
    await mocks.store.addTextPin("Kim left around midnight");
    mocks.queryBoardWithCognee.mockRejectedValueOnce(
      new Error("Cognee Board Query returned 503. Retry when the service is available."),
    );

    const response = await POST(
      new Request("https://clue.test/api/board-query", {
        method: "POST",
        body: JSON.stringify({
          question: "What are the strongest unresolved leads?",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error:
        "Cognee Board Query returned 503. Retry when the service is available.",
      recoverable: true,
    });
  });
});
