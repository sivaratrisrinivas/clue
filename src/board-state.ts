export const CANONICAL_MYSTERY_TITLE = "What happened at the party?";

export type Mystery = {
  id: string;
  title: string;
};

export type Pin = {
  id: string;
  mysteryId: string;
  text: string;
  x: number;
  y: number;
  memoryStatus: "remembering" | "ready_for_connection" | "memory_failed";
  memoryError: string | null;
  deletedAt: Date | null;
};

export type StringKind = "discovered" | "manual";
export type StringSource = "cognee" | "manual";
export type StringStroke = "red_solid" | "blue_dashed";
export type ClueType =
  | "shared_entity"
  | "temporal_proximity"
  | "semantic_relation"
  | "manual_connection";

export type BoardString = {
  id: string;
  mysteryId: string;
  fromPinId: string;
  toPinId: string;
  kind: StringKind;
  source: StringSource;
  clueType: ClueType;
  confidence: number;
  stroke: StringStroke;
  explanation: string;
  recalledMemory: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DiscoveredStringInput = {
  fromPinId: string;
  toPinId: string;
  clueType: Exclude<ClueType, "manual_connection">;
  confidence: number;
  explanation: string;
  recalledMemory?: string | null;
};

export type MysteryBoard = {
  mystery: Mystery;
  pins: Pin[];
  strings: BoardString[];
  events: BoardEvent[];
};

export type BoardEvent = {
  id: string;
  mysteryId: string;
  name: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export interface BoardStateStore {
  getCanonicalMysteryBoard(): Promise<MysteryBoard>;
  addTextPin(text: string): Promise<Pin>;
  addDiscoveredString(input: DiscoveredStringInput): Promise<BoardString>;
  movePin(pinId: string, position: { x: number; y: number }): Promise<Pin>;
  deletePin(pinId: string): Promise<void>;
  markPinReadyForConnection(pinId: string): Promise<Pin>;
  markPinMemoryFailed(pinId: string, message: string): Promise<Pin>;
}

export type QueryExecutor = {
  query(
    text: string,
    params?: readonly unknown[],
  ): Promise<Record<string, unknown>[]>;
};

const canonicalMystery: Mystery = {
  id: "canonical-party-mystery",
  title: CANONICAL_MYSTERY_TITLE,
};

export function createInMemoryBoardStateStore(
  initialBoard: MysteryBoard = {
    mystery: canonicalMystery,
    pins: [],
    strings: [],
    events: [],
  },
): BoardStateStore {
  const board = cloneBoard(initialBoard);

  return {
    async getCanonicalMysteryBoard() {
      return cloneVisibleBoard(board);
    },
    async addTextPin(text) {
      const pin = createRememberingPin(text);
      board.pins.push(pin);
      board.events.push(createBoardEvent("pin.created", { pinId: pin.id }));
      return clonePin(pin);
    },
    async addDiscoveredString(input) {
      assertStringPinsExist(board, input.fromPinId, input.toPinId);
      const string = createDiscoveredString(input);
      board.strings.push(string);
      board.events.push(
        createBoardEvent("string.discovered", {
          stringId: string.id,
          fromPinId: string.fromPinId,
          toPinId: string.toPinId,
          clueType: string.clueType,
        }),
      );
      return cloneString(string);
    },
    async movePin(pinId, position) {
      const pin = findPin(board, pinId);
      pin.x = position.x;
      pin.y = position.y;
      board.events.push(
        createBoardEvent("pin.moved", {
          pinId,
          x: position.x,
          y: position.y,
        }),
      );
      return clonePin(pin);
    },
    async deletePin(pinId) {
      const pin = findPin(board, pinId);
      pin.deletedAt = new Date();
      board.events.push(createBoardEvent("pin.deleted", { pinId }));
    },
    async markPinReadyForConnection(pinId) {
      const pin = findPin(board, pinId);
      pin.memoryStatus = "ready_for_connection";
      pin.memoryError = null;
      board.events.push(createBoardEvent("pin.remembered", { pinId }));
      return clonePin(pin);
    },
    async markPinMemoryFailed(pinId, message) {
      const pin = findPin(board, pinId);
      pin.memoryStatus = "memory_failed";
      pin.memoryError = message;
      board.events.push(createBoardEvent("pin.memory_failed", { pinId }));
      return clonePin(pin);
    },
  };
}

export function createNeonBoardStateStore(executor: QueryExecutor): BoardStateStore {
  return {
    async getCanonicalMysteryBoard() {
      await ensureCanonicalMystery(executor);

      const [mystery] = await queryRows<MysteryRow>(
        executor,
        `select id, title
         from mysteries
         where id = $1`,
        [canonicalMystery.id],
      );
      const pins = await queryRows<PinRow>(
        executor,
        `select id, mystery_id, text, x, y, memory_status, memory_error, deleted_at
         from pins
         where mystery_id = $1 and deleted_at is null
         order by created_at asc`,
        [canonicalMystery.id],
      );
      const strings = await queryRows<StringRow>(
        executor,
        `select id, mystery_id, from_pin_id, to_pin_id, kind, source, clue_type,
           confidence, stroke, explanation, recalled_memory, created_at, updated_at
         from strings
         where mystery_id = $1
           and exists (
             select 1 from pins
             where pins.id = strings.from_pin_id
               and pins.deleted_at is null
           )
           and exists (
             select 1 from pins
             where pins.id = strings.to_pin_id
               and pins.deleted_at is null
           )
         order by created_at asc`,
        [canonicalMystery.id],
      );
      const events = await queryRows<EventRow>(
        executor,
        `select id, mystery_id, name, payload, created_at
         from events
         where mystery_id = $1
         order by created_at asc`,
        [canonicalMystery.id],
      );

      return {
        mystery: {
          id: mystery?.id ?? canonicalMystery.id,
          title: mystery?.title ?? canonicalMystery.title,
        },
        pins: pins.map(mapPinRow),
        strings: strings.map(mapStringRow),
        events: events.map(mapEventRow),
      };
    },
    async addTextPin(text) {
      await ensureCanonicalMystery(executor);

      const pin = createRememberingPin(text);
      await executor.query(
        `insert into pins (id, mystery_id, text, x, y, memory_status, memory_error)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pin.id,
          pin.mysteryId,
          pin.text,
          pin.x,
          pin.y,
          pin.memoryStatus,
          pin.memoryError,
        ],
      );
      await insertEvent(executor, "pin.created", { pinId: pin.id });

      return pin;
    },
    async addDiscoveredString(input) {
      await ensureCanonicalMystery(executor);

      const string = createDiscoveredString(input);
      const [savedString] = await queryRows<StringRow>(
        executor,
        `insert into strings (
           id,
           mystery_id,
           from_pin_id,
           to_pin_id,
           kind,
           source,
           clue_type,
           confidence,
           stroke,
           explanation,
           recalled_memory
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         returning id, mystery_id, from_pin_id, to_pin_id, kind, source, clue_type,
           confidence, stroke, explanation, recalled_memory, created_at, updated_at`,
        [
          string.id,
          string.mysteryId,
          string.fromPinId,
          string.toPinId,
          string.kind,
          string.source,
          string.clueType,
          string.confidence,
          string.stroke,
          string.explanation,
          string.recalledMemory,
        ],
      );
      const mappedString = mapRequiredString(savedString, string.id);
      await insertEvent(executor, "string.discovered", {
        stringId: mappedString.id,
        fromPinId: mappedString.fromPinId,
        toPinId: mappedString.toPinId,
        clueType: mappedString.clueType,
      });

      return mappedString;
    },
    async movePin(pinId, position) {
      const [pin] = await queryRows<PinRow>(
        executor,
        `update pins
         set x = $3,
             y = $4,
             updated_at = now()
         where id = $1 and mystery_id = $2 and deleted_at is null
         returning id, mystery_id, text, x, y, memory_status, memory_error, deleted_at`,
        [pinId, canonicalMystery.id, position.x, position.y],
      );
      await insertEvent(executor, "pin.moved", {
        pinId,
        x: position.x,
        y: position.y,
      });
      return mapRequiredPin(pin, pinId);
    },
    async deletePin(pinId) {
      await executor.query(
        `update pins
         set deleted_at = now(),
             updated_at = now()
         where id = $1 and mystery_id = $2 and deleted_at is null`,
        [pinId, canonicalMystery.id],
      );
      await insertEvent(executor, "pin.deleted", { pinId });
    },
    async markPinReadyForConnection(pinId) {
      const [pin] = await queryRows<PinRow>(
        executor,
        `update pins
         set memory_status = 'ready_for_connection',
             memory_error = null,
             updated_at = now()
         where id = $1 and mystery_id = $2 and deleted_at is null
         returning id, mystery_id, text, x, y, memory_status, memory_error, deleted_at`,
        [pinId, canonicalMystery.id],
      );
      await insertEvent(executor, "pin.remembered", { pinId });
      return mapRequiredPin(pin, pinId);
    },
    async markPinMemoryFailed(pinId, message) {
      const [pin] = await queryRows<PinRow>(
        executor,
        `update pins
         set memory_status = 'memory_failed',
             memory_error = $3,
             updated_at = now()
         where id = $1 and mystery_id = $2 and deleted_at is null
         returning id, mystery_id, text, x, y, memory_status, memory_error, deleted_at`,
        [pinId, canonicalMystery.id, message],
      );
      await insertEvent(executor, "pin.memory_failed", { pinId });
      return mapRequiredPin(pin, pinId);
    },
  };
}

async function ensureCanonicalMystery(executor: QueryExecutor): Promise<void> {
  await executor.query(
    `insert into mysteries (id, title)
     values ($1, $2)
     on conflict (id) do update
     set title = excluded.title,
         updated_at = now()`,
    [canonicalMystery.id, canonicalMystery.title],
  );
}

async function insertEvent(
  executor: QueryExecutor,
  name: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await executor.query(
    `insert into events (id, mystery_id, name, payload)
     values ($1, $2, $3, $4)`,
    [crypto.randomUUID(), canonicalMystery.id, name, JSON.stringify(payload)],
  );
}

async function queryRows<T>(
  executor: QueryExecutor,
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  return (await executor.query(text, params)) as T[];
}

function cloneBoard(board: MysteryBoard): MysteryBoard {
  return {
    mystery: { ...board.mystery },
    pins: board.pins.map(clonePin),
    strings: board.strings.map(cloneString),
    events: board.events.map((event) => ({
      ...event,
      payload: { ...event.payload },
      createdAt: new Date(event.createdAt),
    })),
  };
}

function cloneVisibleBoard(board: MysteryBoard): MysteryBoard {
  const visiblePins = board.pins.filter((pin) => pin.deletedAt === null);
  const visiblePinIds = new Set(visiblePins.map((pin) => pin.id));

  return cloneBoard({
    ...board,
    pins: visiblePins,
    strings: board.strings.filter(
      (string) =>
        visiblePinIds.has(string.fromPinId) && visiblePinIds.has(string.toPinId),
    ),
  });
}

function cloneString(string: BoardString): BoardString {
  return {
    ...string,
    createdAt: new Date(string.createdAt),
    updatedAt: new Date(string.updatedAt),
  };
}

function clonePin(pin: Pin): Pin {
  return {
    ...pin,
    deletedAt: pin.deletedAt ? new Date(pin.deletedAt) : null,
  };
}

function createRememberingPin(text: string): Pin {
  return {
    id: crypto.randomUUID(),
    mysteryId: canonicalMystery.id,
    text,
    x: 120,
    y: 140,
    memoryStatus: "remembering",
    memoryError: null,
    deletedAt: null,
  };
}

function createDiscoveredString(input: DiscoveredStringInput): BoardString {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    mysteryId: canonicalMystery.id,
    fromPinId: input.fromPinId,
    toPinId: input.toPinId,
    kind: "discovered",
    source: "cognee",
    clueType: input.clueType,
    confidence: input.confidence,
    stroke: "red_solid",
    explanation: input.explanation,
    recalledMemory: input.recalledMemory ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function createBoardEvent(
  name: string,
  payload: Record<string, unknown>,
): BoardEvent {
  return {
    id: crypto.randomUUID(),
    mysteryId: canonicalMystery.id,
    name,
    payload,
    createdAt: new Date(),
  };
}

function findPin(board: MysteryBoard, pinId: string): Pin {
  const pin = board.pins.find((candidate) => candidate.id === pinId);
  if (!pin) {
    throw new Error(`Pin ${pinId} was not found`);
  }

  return pin;
}

function assertStringPinsExist(
  board: MysteryBoard,
  fromPinId: string,
  toPinId: string,
): void {
  findPin(board, fromPinId);
  findPin(board, toPinId);
}

type MysteryRow = {
  id: string;
  title: string;
};

type PinRow = {
  id: string;
  mystery_id: string;
  text: string;
  x: number;
  y: number;
  memory_status: Pin["memoryStatus"];
  memory_error: string | null;
  deleted_at: Date | string | null;
};

type StringRow = {
  id: string;
  mystery_id: string;
  from_pin_id: string;
  to_pin_id: string;
  kind: StringKind;
  source: StringSource;
  clue_type: ClueType;
  confidence: number | string;
  stroke: StringStroke;
  explanation: string;
  recalled_memory: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type EventRow = {
  id: string;
  mystery_id: string;
  name: string;
  payload: Record<string, unknown> | string;
  created_at: Date | string;
};

function mapPinRow(row: PinRow): Pin {
  return {
    id: row.id,
    mysteryId: row.mystery_id,
    text: row.text,
    x: row.x,
    y: row.y,
    memoryStatus: row.memory_status,
    memoryError: row.memory_error,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

function mapRequiredPin(row: PinRow | undefined, pinId: string): Pin {
  if (!row) {
    throw new Error(`Pin ${pinId} was not found`);
  }

  return mapPinRow(row);
}

function mapRequiredString(
  row: StringRow | undefined,
  stringId: string,
): BoardString {
  if (!row) {
    throw new Error(`String ${stringId} was not saved`);
  }

  return mapStringRow(row);
}

function mapStringRow(row: StringRow): BoardString {
  return {
    id: row.id,
    mysteryId: row.mystery_id,
    fromPinId: row.from_pin_id,
    toPinId: row.to_pin_id,
    kind: row.kind,
    source: row.source,
    clueType: row.clue_type,
    confidence:
      typeof row.confidence === "string"
        ? Number.parseFloat(row.confidence)
        : row.confidence,
    stroke: row.stroke,
    explanation: row.explanation,
    recalledMemory: row.recalled_memory,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapEventRow(row: EventRow): BoardEvent {
  return {
    id: row.id,
    mysteryId: row.mystery_id,
    name: row.name,
    payload:
      typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : row.payload,
    createdAt: new Date(row.created_at),
  };
}
