import "server-only";

import { neon } from "@neondatabase/serverless";

import type { QueryExecutor } from "./board-state";

export function createNeonQueryExecutor(databaseUrl: string): QueryExecutor {
  const sql = neon(databaseUrl);

  return {
    query(text, params) {
      return sql.query(text, params ? [...params] : []);
    },
  };
}
