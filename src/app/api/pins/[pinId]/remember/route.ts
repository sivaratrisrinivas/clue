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
    const discoveredStrings = await rememberPinWithCognee(pin, board.pins);
    await store.markPinReadyForConnection(pinId);

    for (const discoveredString of discoveredStrings) {
      await store.addDiscoveredString(discoveredString);
    }

    return NextResponse.json(await store.getCanonicalMysteryBoard());
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cognee memory failed. Retry when the service is available.";
    await store.markPinMemoryFailed(pinId, message);
    return NextResponse.json(await store.getCanonicalMysteryBoard());
  }
}
