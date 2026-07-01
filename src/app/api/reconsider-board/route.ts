import { NextResponse } from "next/server";

import { reconsiderBoardWithCognee } from "../../../cognee-memory";
import { createServerBoardStateStore } from "../../../server-board-store";
import type { BoardString, DiscoveredStringInput } from "../../../board-state";

export async function POST(_request: Request) {
  const store = await createServerBoardStateStore();
  const board = await store.getCanonicalMysteryBoard();

  try {
    const discoveredStrings = onlyNewDiscoveredStrings(
      await reconsiderBoardWithCognee(board),
      board.strings,
    );

    for (const discoveredString of discoveredStrings) {
      await store.addDiscoveredString(discoveredString);
    }

    return NextResponse.json({
      board: await store.getCanonicalMysteryBoard(),
      reconsiderBoard: {
        newStringCount: discoveredStrings.length,
        ...(discoveredStrings.length === 0
          ? { message: "No new Clues yet." }
          : {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cognee Reconsider Board failed. Retry when the service is available.";

    return NextResponse.json(
      {
        error: message,
        recoverable: true,
      },
      { status: 503 },
    );
  }
}

function onlyNewDiscoveredStrings(
  discoveredStrings: readonly DiscoveredStringInput[],
  existingStrings: readonly BoardString[],
): DiscoveredStringInput[] {
  const existingCogneeKeys = new Set(
    existingStrings
      .filter((string) => string.source === "cognee")
      .map((string) =>
        discoveredStringKey({
          fromPinId: string.fromPinId,
          toPinId: string.toPinId,
          clueType: string.clueType,
        }),
      ),
  );

  return discoveredStrings.filter(
    (string) => !existingCogneeKeys.has(discoveredStringKey(string)),
  );
}

function discoveredStringKey(
  string: Pick<BoardString, "fromPinId" | "toPinId" | "clueType">,
): string {
  return [[string.fromPinId, string.toPinId].sort().join(":"), string.clueType].join(
    "|",
  );
}
