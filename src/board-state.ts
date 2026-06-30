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
};

export interface BoardStateStore {
  getCanonicalMysteryBoard(): Promise<MysteryBoard>;
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
  },
): BoardStateStore {
  const board = cloneBoard(initialBoard);

  return {
    async getCanonicalMysteryBoard() {
      return cloneBoard(board);
    },
  };
}

export function createNeonBoardStateStore(executor: QueryExecutor): BoardStateStore {
  return {
    async getCanonicalMysteryBoard() {
      await executor.query(
        `insert into mysteries (id, title)
         values ($1, $2)
         on conflict (id) do update
         set title = excluded.title,
             updated_at = now()`,
        [canonicalMystery.id, canonicalMystery.title],
      );

      const [mystery] = await queryRows<MysteryRow>(
        executor,
        `select id, title
         from mysteries
         where id = $1`,
        [canonicalMystery.id],
      );
      const pins = await queryRows<PinRow>(
        executor,
        `select id, mystery_id, text, x, y, deleted_at
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

      return {
        mystery: {
          id: mystery?.id ?? canonicalMystery.id,
          title: mystery?.title ?? canonicalMystery.title,
        },
        pins: pins.map(mapPinRow),
        strings: strings.map(mapStringRow),
      };
    },
  };
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
    pins: board.pins.map((pin) => ({ ...pin })),
    strings: board.strings.map((string) => ({ ...string })),
  };
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

function mapPinRow(row: PinRow): Pin {
  return {
    id: row.id,
    mysteryId: row.mystery_id,
    text: row.text,
    x: row.x,
    y: row.y,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
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
