import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply Clue migrations.");
}

const sql = neon(databaseUrl);
const migration = await readFile(
  join(process.cwd(), "migrations", "0001_board_state.sql"),
  "utf8",
);

for (const statement of splitSqlStatements(migration)) {
  await sql.query(statement);
}

console.log("Applied Clue board-state migration.");

function splitSqlStatements(sqlText) {
  return sqlText
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}
