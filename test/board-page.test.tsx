import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
