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

export type BoardString = {
  id: string;
  mysteryId: string;
  fromPinId: string;
  toPinId: string;
  kind: StringKind;
  clueType:
    | "shared_entity"
    | "temporal_proximity"
    | "semantic_relation"
    | "manual_connection";
  explanation: string;
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
      return cloneBoard(board);
    },
    async addTextPin(text) {
      const pin = createRememberingPin(text);
      board.pins.push(pin);
      board.events.push(createBoardEvent("pin.created", { pinId: pin.id }));
      return clonePin(pin);
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
        `select id, mystery_id, from_pin_id, to_pin_id, kind, clue_type, explanation
         from strings
         where mystery_id = $1
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
    strings: board.strings.map((string) => ({ ...string })),
    events: board.events.map((event) => ({
      ...event,
      payload: { ...event.payload },
      createdAt: new Date(event.createdAt),
    })),
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
  clue_type: BoardString["clueType"];
  explanation: string;
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

function mapStringRow(row: StringRow): BoardString {
  return {
    id: row.id,
    mysteryId: row.mystery_id,
    fromPinId: row.from_pin_id,
    toPinId: row.to_pin_id,
    kind: row.kind,
    clueType: row.clue_type,
    explanation: row.explanation,
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
