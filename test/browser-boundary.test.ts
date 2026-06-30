import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("browser boundary", () => {
  it("does not expose Cognee configuration to the browser", () => {
    const clientSurface = [
      readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8"),
    ].join("\n");

    expect(clientSurface).not.toMatch(/NEXT_PUBLIC_COGNEE/i);
    expect(clientSurface).not.toMatch(/from ["'].*cognee/i);
  });
});
