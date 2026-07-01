import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Board } from "../src/app/board";
import Home from "../src/app/page";
import { createSyntheticDemoRound } from "../src/demo-round";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Mystery board page", () => {
  it("opens directly to a prefilled synthetic Investigation Round", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "Who hid the flash drive after the party?",
      }),
    ).toBeVisible();
    expect(screen.getByRole("main", { name: "Mystery board" })).toBeVisible();
    expect(screen.getByText("Synthetic round loaded")).toBeVisible();
    expect(screen.getByText("4/8 Pins revealed")).toBeVisible();
    expect(screen.getByText(/Party invite says/)).toBeVisible();
    expect(screen.queryByText(/Doorman saw Kim/)).not.toBeInTheDocument();
  });

  it("lets an investigator reveal synthetic Pins instead of typing them", () => {
    render(<Board initialBoard={createSyntheticDemoRound().board} />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));

    expect(screen.getByText(/Doorman saw Kim/)).toBeVisible();
    expect(screen.getByText(/Spare keycard used/)).toBeVisible();
    expect(screen.getByText("6/8 Pins revealed")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));

    expect(screen.getByText(/Voicemail from Theo/)).toBeVisible();
    expect(screen.getByText(/Recovered photo shows/)).toBeVisible();
    expect(screen.getByText("8/8 Pins revealed")).toBeVisible();
  });

  it("answers a prefilled Board Query from synthetic data", () => {
    render(<Board initialBoard={createSyntheticDemoRound().board} />);

    fireEvent.click(screen.getByRole("button", { name: "Query" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Which Pins put pressure on Kim?",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Board Query" }));

    const answer = screen.getByLabelText("Board Query answer");
    expect(within(answer).getByText("Entity connections")).toBeVisible();
    expect(within(answer).getByText(/Kim's text/)).toBeVisible();
    expect(within(answer).getByText("Grounded in 3 Pins")).toBeVisible();
  });

  it("surfaces Cognee-style Strings during Reconsider Board", () => {
    render(<Board initialBoard={createSyntheticDemoRound().board} />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Reconsider Board" }));

    expect(screen.getByText("3 new Clues surfaced")).toBeVisible();

    const string = screen.getByRole("button", {
      name: /Cognee String between Kim texted Maya/,
    });
    expect(string).toHaveClass("string-line--red-solid");

    fireEvent.click(string);

    const dialog = screen.getByRole("dialog", { name: "String explanation" });
    expect(within(dialog).getByText("Temporal proximity")).toBeVisible();
    expect(within(dialog).getByText(/Kim asked for ten minutes/)).toBeVisible();
  });

  it("keeps the human in the loop with a manual String and final verdict", () => {
    render(<Board initialBoard={createSyntheticDemoRound().board} />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "String" }));
    fireEvent.click(screen.getByText(/Kim texted Maya/));
    fireEvent.click(screen.getByText(/Spare keycard used/));

    const manualString = screen.getByRole("button", {
      name: /Manual String between Kim texted Maya/,
    });
    expect(manualString).toHaveClass("string-line--blue-dashed");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Kim hid the flash drive under the DJ booth.",
      }),
    );

    expect(screen.getByText(/^Correct\./)).toBeVisible();
  });
});
