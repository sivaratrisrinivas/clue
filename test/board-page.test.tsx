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
});
