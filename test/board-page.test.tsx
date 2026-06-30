import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../src/app/page";
import { CANONICAL_MYSTERY_TITLE } from "../src/board-state";

describe("Mystery board page", () => {
  it("opens directly to the canonical empty Mystery board", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", { name: CANONICAL_MYSTERY_TITLE }),
    ).toBeVisible();
    expect(screen.getByRole("main", { name: "Mystery board" })).toBeVisible();
    expect(screen.getByText("No Pins yet")).toBeVisible();
  });
});
