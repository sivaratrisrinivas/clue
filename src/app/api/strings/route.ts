import { NextResponse } from "next/server";

import { createServerBoardStateStore } from "../../../server-board-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    fromPinId?: unknown;
    toPinId?: unknown;
  };

  if (typeof body.fromPinId !== "string" || typeof body.toPinId !== "string") {
    return NextResponse.json(
      { error: "Manual String requires fromPinId and toPinId" },
      { status: 400 },
    );
  }

  const store = await createServerBoardStateStore();
  await store.addManualString({
    fromPinId: body.fromPinId,
    toPinId: body.toPinId,
  });
  const board = await store.getCanonicalMysteryBoard();

  return NextResponse.json(board, { status: 201 });
}
