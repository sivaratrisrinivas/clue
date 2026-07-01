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

  it("persists a defensible Cognee-discovered String as board rendering state", async () => {
    const store = createInMemoryBoardStateStore();
    const firstPin = await store.addTextPin("Kim left around midnight");
    const secondPin = await store.addTextPin("The Lucky Star receipt was printed at 12:43 AM");

    const string = await store.addDiscoveredString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      clueType: "temporal_proximity",
      confidence: 0.86,
      explanation:
        "Cognee recalled both Pins around the same late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near each other.",
    });
    const board = await store.getCanonicalMysteryBoard();

    expect(string).toMatchObject({
      mysteryId: "canonical-party-mystery",
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      kind: "discovered",
      source: "cognee",
      clueType: "temporal_proximity",
      confidence: 0.86,
      stroke: "red_solid",
      explanation:
        "Cognee recalled both Pins around the same late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near each other.",
    });
    expect(board.strings).toEqual([string]);
    expect(board.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "string.discovered",
          payload: {
            stringId: string.id,
            fromPinId: firstPin.id,
            toPinId: secondPin.id,
            clueType: "temporal_proximity",
          },
        }),
      ]),
    );
  });

  it("persists a manual String separately from Cognee-discovered Strings", async () => {
    const store = createInMemoryBoardStateStore();
    const firstPin = await store.addTextPin("Kim left around midnight");
    const secondPin = await store.addTextPin("Lucky Star receipt at 12:43 AM");
    const discoveredString = await store.addDiscoveredString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      clueType: "temporal_proximity",
      confidence: 0.86,
      explanation: "Cognee recalled both Pins in the same late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near each other.",
    });

    const manualString = await store.addManualString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
    });
    const board = await store.getCanonicalMysteryBoard();

    expect(manualString).toMatchObject({
      mysteryId: "canonical-party-mystery",
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      kind: "manual",
      source: "manual",
      clueType: "manual_connection",
      confidence: 1,
      stroke: "blue_dashed",
      explanation:
        "An investigator manually connected these Pins on the board.",
      recalledMemory: null,
    });
    expect(board.strings).toEqual([discoveredString, manualString]);
    expect(board.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "string.manual_created",
          payload: {
            stringId: manualString.id,
            fromPinId: firstPin.id,
            toPinId: secondPin.id,
            clueType: "manual_connection",
          },
        }),
      ]),
    );
  });

  it("moves a Pin and restores its updated board position", async () => {
    const store = createInMemoryBoardStateStore();
    const pin = await store.addTextPin("Kim left around midnight");

    const movedPin = await store.movePin(pin.id, { x: 360, y: 225 });
    const board = await store.getCanonicalMysteryBoard();

    expect(movedPin).toMatchObject({
      id: pin.id,
      x: 360,
      y: 225,
    });
    expect(board.pins).toEqual([movedPin]);
    expect(board.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "pin.moved",
          payload: { pinId: pin.id, x: 360, y: 225 },
        }),
      ]),
    );
  });

  it("deletes a Pin and restores a board without incoherent visible Strings", async () => {
    const store = createInMemoryBoardStateStore();
    const firstPin = await store.addTextPin("Kim left around midnight");
    const secondPin = await store.addTextPin("Lucky Star receipt at 12:43 AM");
    await store.addDiscoveredString({
      fromPinId: firstPin.id,
      toPinId: secondPin.id,
      clueType: "temporal_proximity",
      confidence: 0.86,
      explanation: "Cognee recalled both Pins in the same late-night window.",
      recalledMemory: "Kim leaving and the receipt timestamp are near each other.",
    });

    await store.deletePin(firstPin.id);
    const board = await store.getCanonicalMysteryBoard();

    expect(board.pins).toEqual([expect.objectContaining({ id: secondPin.id })]);
    expect(board.strings).toEqual([]);
    expect(board.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "pin.deleted",
          payload: { pinId: firstPin.id },
        }),
      ]),
    );
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

  it("persists Pin movement through a Neon query executor", async () => {
    const queries: Array<{ text: string; params: readonly unknown[] | undefined }> = [];
    const store = createNeonBoardStateStore({
      async query(text, params) {
        queries.push({ text, params });

        if (text.includes("update pins")) {
          return [
            {
              id: "pin-kim-left",
              mystery_id: "canonical-party-mystery",
              text: "Kim left around midnight",
              x: 360,
              y: 225,
              memory_status: "ready_for_connection",
              memory_error: null,
              deleted_at: null,
            },
          ];
        }

        return [];
      },
    });

    const movedPin = await store.movePin("pin-kim-left", { x: 360, y: 225 });

    expect(movedPin).toMatchObject({ id: "pin-kim-left", x: 360, y: 225 });
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("set x = $3"),
          params: ["pin-kim-left", "canonical-party-mystery", 360, 225],
        }),
        expect.objectContaining({
          text: expect.stringContaining("insert into events"),
          params: expect.arrayContaining([
            "canonical-party-mystery",
            "pin.moved",
            JSON.stringify({ pinId: "pin-kim-left", x: 360, y: 225 }),
          ]),
        }),
      ]),
    );
  });

  it("persists a manual String through a Neon query executor", async () => {
    const queries: Array<{ text: string; params: readonly unknown[] | undefined }> = [];
    const store = createNeonBoardStateStore({
      async query(text, params) {
        queries.push({ text, params });

        if (text.includes("insert into strings")) {
          return [
            {
              id: params?.[0],
              mystery_id: "canonical-party-mystery",
              from_pin_id: "pin-kim-left",
              to_pin_id: "pin-receipt",
              kind: "manual",
              source: "manual",
              clue_type: "manual_connection",
              confidence: 1,
              stroke: "blue_dashed",
              explanation:
                "An investigator manually connected these Pins on the board.",
              recalled_memory: null,
              created_at: "2026-07-01T00:00:00.000Z",
              updated_at: "2026-07-01T00:00:00.000Z",
            },
          ];
        }

        return [];
      },
    });

    const string = await store.addManualString({
      fromPinId: "pin-kim-left",
      toPinId: "pin-receipt",
    });

    expect(string).toMatchObject({
      fromPinId: "pin-kim-left",
      toPinId: "pin-receipt",
      kind: "manual",
      source: "manual",
      clueType: "manual_connection",
      confidence: 1,
      stroke: "blue_dashed",
      recalledMemory: null,
    });
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("insert into strings"),
          params: expect.arrayContaining([
            "canonical-party-mystery",
            "pin-kim-left",
            "pin-receipt",
            "manual",
            "manual",
            "manual_connection",
            1,
            "blue_dashed",
            "An investigator manually connected these Pins on the board.",
            null,
          ]),
        }),
        expect.objectContaining({
          text: expect.stringContaining("insert into events"),
          params: expect.arrayContaining([
            "canonical-party-mystery",
            "string.manual_created",
            JSON.stringify({
              stringId: string.id,
              fromPinId: "pin-kim-left",
              toPinId: "pin-receipt",
              clueType: "manual_connection",
            }),
          ]),
        }),
      ]),
    );
  });

  it("persists Pin deletion through a Neon query executor", async () => {
    const queries: Array<{ text: string; params: readonly unknown[] | undefined }> = [];
    const store = createNeonBoardStateStore({
      async query(text, params) {
        queries.push({ text, params });
        return [];
      },
    });

    await store.deletePin("pin-kim-left");

    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("set deleted_at = now()"),
          params: ["pin-kim-left", "canonical-party-mystery"],
        }),
        expect.objectContaining({
          text: expect.stringContaining("insert into events"),
          params: expect.arrayContaining([
            "canonical-party-mystery",
            "pin.deleted",
            JSON.stringify({ pinId: "pin-kim-left" }),
          ]),
        }),
      ]),
    );
  });
});
