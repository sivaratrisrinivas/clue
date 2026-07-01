import { NextResponse } from "next/server";

import { createServerBoardStateStore } from "../../../../server-board-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pinId: string }> },
) {
  const { pinId } = await context.params;
  const body = (await request.json()) as { x?: unknown; y?: unknown };

  if (typeof body.x !== "number" || typeof body.y !== "number") {
    return NextResponse.json(
      { error: "Pin position requires numeric x and y coordinates" },
      { status: 400 },
    );
  }

  const store = await createServerBoardStateStore();
  await store.movePin(pinId, { x: body.x, y: body.y });
  const board = await store.getCanonicalMysteryBoard();

  return NextResponse.json(board);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ pinId: string }> },
) {
  const { pinId } = await context.params;
  const store = await createServerBoardStateStore();
  await store.deletePin(pinId);
  const board = await store.getCanonicalMysteryBoard();

  return NextResponse.json(board);
}
