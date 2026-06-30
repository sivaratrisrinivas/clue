import { NextResponse } from "next/server";

import { rememberPinWithCognee } from "../../../../../cognee-memory";
import { createServerBoardStateStore } from "../../../../../server-board-store";

type RouteContext = {
  params: Promise<{ pinId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { pinId } = await context.params;
  const store = await createServerBoardStateStore();
  const board = await store.getCanonicalMysteryBoard();
  const pin = board.pins.find((candidate) => candidate.id === pinId);

  if (!pin) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  try {
    await rememberPinWithCognee(pin);
    const updatedPin = await store.markPinReadyForConnection(pinId);
    return NextResponse.json(updatedPin);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cognee memory failed. Retry when the service is available.";
    const updatedPin = await store.markPinMemoryFailed(pinId, message);
    return NextResponse.json(updatedPin);
  }
}
