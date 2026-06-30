import {
  createInMemoryBoardStateStore,
  type BoardStateStore,
} from "./board-state";
import { createBoardStateStore } from "./board-state-source";

let fallbackStore: BoardStateStore | undefined;

export async function createServerBoardStateStore() {
  const databaseUrl = process.env.DATABASE_URL;
  const createExecutor = databaseUrl
    ? (await import("./neon-executor")).createNeonQueryExecutor
    : undefined;

  if (databaseUrl && createExecutor) {
    return createBoardStateStore({
      databaseUrl,
      createExecutor,
    });
  }

  fallbackStore ??= createInMemoryBoardStateStore();
  return fallbackStore;
}
