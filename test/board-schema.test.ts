import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("board state schema", () => {
  it("creates only the app-owned board rendering tables", () => {
    const migration = readFileSync(
      join(process.cwd(), "migrations", "0001_board_state.sql"),
      "utf8",
    ).toLowerCase();

    expect(createdTables(migration)).toEqual([
      "events",
      "mysteries",
      "pins",
      "strings",
    ]);
    expect(migration).not.toMatch(
      /create\s+table\s+(entities|embeddings|graph_nodes|semantic_relationships)\b/,
    );
  });
});

function createdTables(sql: string): string[] {
  return Array.from(sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_]+)/g))
    .map((match) => match[1])
    .sort();
}
