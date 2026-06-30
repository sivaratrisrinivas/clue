import { NextResponse } from "next/server";

import { createServerBoardStateStore } from "../../../server-board-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Pin text is required" }, { status: 400 });
  }

  const store = await createServerBoardStateStore();
  const pin = await store.addTextPin(text);

  return NextResponse.json(pin, { status: 201 });
}
