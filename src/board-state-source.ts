import {
  CANONICAL_MYSTERY_TITLE,
  type BoardStateStore,
  createInMemoryBoardStateStore,
  createNeonBoardStateStore,
  type QueryExecutor,
} from "./board-state";

export { CANONICAL_MYSTERY_TITLE };

export type BoardStateStoreConfig = {
  databaseUrl?: string;
  createExecutor?: (databaseUrl: string) => QueryExecutor;
};

export function createBoardStateStore(
  config: BoardStateStoreConfig = {},
): BoardStateStore {
  if (config.databaseUrl && config.createExecutor) {
    return createNeonBoardStateStore(config.createExecutor(config.databaseUrl));
  }

  return createInMemoryBoardStateStore();
}
