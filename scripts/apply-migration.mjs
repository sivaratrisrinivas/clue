import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply Clue migrations.");
}

const sql = neon(databaseUrl);
const migrationsDir = join(process.cwd(), "migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const migrationFile of migrationFiles) {
  const migration = await readFile(join(migrationsDir, migrationFile), "utf8");

  for (const statement of splitSqlStatements(migration)) {
    await sql.query(statement);
  }
}

console.log(`Applied ${migrationFiles.length} Clue migration(s).`);

function splitSqlStatements(sqlText) {
  const statements = [];
  let statement = "";
  let dollarQuoteTag = null;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    statement += char;

    if (char === "$") {
      const tag = readDollarQuoteTag(sqlText, index);
      if (tag) {
        if (!dollarQuoteTag) {
          dollarQuoteTag = tag;
          index += tag.length - 1;
          statement += sqlText.slice(index + 1 - (tag.length - 1), index + 1);
          statement = statement.slice(0, -tag.length) + tag;
          continue;
        }

        if (dollarQuoteTag === tag) {
          dollarQuoteTag = null;
          index += tag.length - 1;
          statement += sqlText.slice(index + 1 - (tag.length - 1), index + 1);
          statement = statement.slice(0, -tag.length) + tag;
          continue;
        }
      }
    }

    if (char === ";" && !dollarQuoteTag) {
      statements.push(statement.slice(0, -1).trim());
      statement = "";
    }
  }

  if (statement.trim()) {
    statements.push(statement.trim());
  }

  return statements.filter(Boolean);
}

function readDollarQuoteTag(sqlText, startIndex) {
  const match = sqlText.slice(startIndex).match(/^\$[A-Za-z0-9_]*\$/);
  return match?.[0] ?? null;
}
