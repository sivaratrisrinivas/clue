import { NextResponse } from "next/server";

import { queryBoardWithCognee } from "../../../cognee-memory";
import { createServerBoardStateStore } from "../../../server-board-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json(
      { error: "Board Query question is required" },
      { status: 400 },
    );
  }

  const store = await createServerBoardStateStore();
  const board = await store.getCanonicalMysteryBoard();
  try {
    const answer = await queryBoardWithCognee(question, board);

    return NextResponse.json(answer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cognee Board Query failed. Retry when the service is available.";
    return NextResponse.json(
      {
        error: message,
        recoverable: true,
      },
      { status: 503 },
    );
  }
}
