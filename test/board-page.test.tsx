import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "../src/app/page";
import { Board } from "../src/app/board";
import { CANONICAL_MYSTERY_TITLE } from "../src/board-state";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Mystery board page", () => {
  it("opens directly to the canonical empty Mystery board", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", { name: CANONICAL_MYSTERY_TITLE }),
    ).toBeVisible();
    expect(screen.getByRole("main", { name: "Mystery board" })).toBeVisible();
    expect(screen.getByText("No Pins yet")).toBeVisible();
  });

  it("lets an investigator add a text-only Pin and see it remembering", async () => {
    const pin = {
      id: "pin-kim-left",
      mysteryId: "canonical-party-mystery",
      text: "Kim left around midnight",
      x: 120,
      y: 140,
      memoryStatus: "remembering" as const,
      memoryError: null,
      deletedAt: null,
    };
    const pendingRemember = new Promise<Response>(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("/remember")) {
          return pendingRemember;
        }

        return Promise.resolve(
          new Response(JSON.stringify(pin), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    render(
      <Board
        initialBoard={{
          mystery: {
            id: "canonical-party-mystery",
            title: CANONICAL_MYSTERY_TITLE,
          },
          pins: [],
          strings: [],
          events: [],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Pin text"), {
      target: { value: "Kim left around midnight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Pin" }));

    await waitFor(() => {
      expect(screen.getByText("Kim left around midnight")).toBeVisible();
    });
    expect(screen.getByText("Remembering")).toBeVisible();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/pins/pin-kim-left/remember", {
        method: "POST",
      });
    });
  });

  it("renders a Cognee-discovered String and opens its explanation", async () => {
    render(
      <Board
        initialBoard={{
          mystery: {
            id: "canonical-party-mystery",
            title: CANONICAL_MYSTERY_TITLE,
          },
          pins: [
            {
              id: "pin-kim-left",
              mysteryId: "canonical-party-mystery",
              text: "Kim left around midnight",
              x: 120,
              y: 140,
              memoryStatus: "ready_for_connection",
              memoryError: null,
              deletedAt: null,
            },
            {
              id: "pin-receipt",
              mysteryId: "canonical-party-mystery",
              text: "Lucky Star receipt at 12:43 AM",
              x: 420,
              y: 260,
              memoryStatus: "ready_for_connection",
              memoryError: null,
              deletedAt: null,
            },
          ],
          strings: [
            {
              id: "string-late-night",
              mysteryId: "canonical-party-mystery",
              fromPinId: "pin-kim-left",
              toPinId: "pin-receipt",
              kind: "discovered",
              source: "cognee",
              clueType: "temporal_proximity",
              confidence: 0.86,
              stroke: "red_solid",
              explanation:
                "Cognee recalled both Pins in the same late-night window.",
              recalledMemory:
                "Kim leaving and the Lucky Star receipt were close in time.",
              createdAt: new Date("2026-07-01T00:00:00.000Z"),
              updatedAt: new Date("2026-07-01T00:00:00.000Z"),
            },
          ],
          events: [],
        }}
      />,
    );

    const string = screen.getByRole("button", {
      name: "Cognee String between Kim left around midnight and Lucky Star receipt at 12:43 AM",
    });
    expect(string).toBeVisible();
    expect(string).toHaveClass("string-line--red-solid");

    fireEvent.click(string);

    const dialog = screen.getByRole("dialog", { name: "String explanation" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("Kim left around midnight")).toBeVisible();
    expect(within(dialog).getByText("Lucky Star receipt at 12:43 AM")).toBeVisible();
    expect(within(dialog).getByText("Temporal proximity")).toBeVisible();
    expect(
      screen.getByText("Cognee recalled both Pins in the same late-night window."),
    ).toBeVisible();
    expect(
      screen.getByText("Kim leaving and the Lucky Star receipt were close in time."),
    ).toBeVisible();
  });

  it("lets an investigator drag a Pin and keeps its String connected", async () => {
    const refreshedBoard = {
      mystery: {
        id: "canonical-party-mystery",
        title: CANONICAL_MYSTERY_TITLE,
      },
      pins: [
        {
          id: "pin-kim-left",
          mysteryId: "canonical-party-mystery",
          text: "Kim left around midnight",
          x: 300,
          y: 200,
          memoryStatus: "ready_for_connection" as const,
          memoryError: null,
          deletedAt: null,
        },
        {
          id: "pin-receipt",
          mysteryId: "canonical-party-mystery",
          text: "Lucky Star receipt at 12:43 AM",
          x: 420,
          y: 260,
          memoryStatus: "ready_for_connection" as const,
          memoryError: null,
          deletedAt: null,
        },
      ],
      strings: [
        {
          id: "string-late-night",
          mysteryId: "canonical-party-mystery",
          fromPinId: "pin-kim-left",
          toPinId: "pin-receipt",
          kind: "discovered" as const,
          source: "cognee" as const,
          clueType: "temporal_proximity" as const,
          confidence: 0.86,
          stroke: "red_solid" as const,
          explanation: "Cognee recalled both Pins in the same late-night window.",
          recalledMemory: null,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
      events: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(refreshedBoard), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    render(
      <Board
        initialBoard={{
          ...refreshedBoard,
          pins: [
            { ...refreshedBoard.pins[0], x: 120, y: 140 },
            refreshedBoard.pins[1],
          ],
        }}
      />,
    );

    const pin = screen.getByText("Kim left around midnight").closest("li");
    const string = screen.getByRole("button", {
      name: "Cognee String between Kim left around midnight and Lucky Star receipt at 12:43 AM",
    });
    expect(pin).not.toBeNull();
    expect(string).toHaveStyle({ left: "230px", top: "206px" });

    fireEvent.mouseDown(pin!, {
      button: 0,
      clientX: 130,
      clientY: 150,
    });
    fireEvent.mouseMove(document, {
      clientX: 310,
      clientY: 210,
    });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/pins/pin-kim-left", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 300, y: 200 }),
      });
    });
    await waitFor(() => {
      expect(pin).toHaveStyle({ left: "300px", top: "200px" });
      expect(string).toHaveStyle({ left: "410px", top: "266px" });
    });
  });

  it("lets an investigator delete a mistaken Pin without leaving its String visible", async () => {
    const board = {
      mystery: {
        id: "canonical-party-mystery",
        title: CANONICAL_MYSTERY_TITLE,
      },
      pins: [
        {
          id: "pin-kim-left",
          mysteryId: "canonical-party-mystery",
          text: "Kim left around midnight",
          x: 120,
          y: 140,
          memoryStatus: "ready_for_connection" as const,
          memoryError: null,
          deletedAt: null,
        },
        {
          id: "pin-receipt",
          mysteryId: "canonical-party-mystery",
          text: "Lucky Star receipt at 12:43 AM",
          x: 420,
          y: 260,
          memoryStatus: "ready_for_connection" as const,
          memoryError: null,
          deletedAt: null,
        },
      ],
      strings: [
        {
          id: "string-late-night",
          mysteryId: "canonical-party-mystery",
          fromPinId: "pin-kim-left",
          toPinId: "pin-receipt",
          kind: "discovered" as const,
          source: "cognee" as const,
          clueType: "temporal_proximity" as const,
          confidence: 0.86,
          stroke: "red_solid" as const,
          explanation: "Cognee recalled both Pins in the same late-night window.",
          recalledMemory: null,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
      events: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ...board,
              pins: [board.pins[1]],
              strings: [],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      ),
    );

    render(<Board initialBoard={board} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Pin: Kim left around midnight" }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/pins/pin-kim-left", {
        method: "DELETE",
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Kim left around midnight")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Cognee String between Kim left around midnight and Lucky Star receipt at 12:43 AM",
        }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Lucky Star receipt at 12:43 AM")).toBeVisible();
  });
});
