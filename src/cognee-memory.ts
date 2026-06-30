import type { Pin } from "./board-state";

export class CogneeMemoryUnavailableError extends Error {
  constructor(
    message = "Cognee memory is unavailable to the app runtime. Retry when the server adapter is configured.",
  ) {
    super(message);
    this.name = "CogneeMemoryUnavailableError";
  }
}

export async function rememberPinWithCognee(pin: Pin): Promise<void> {
  const apiKey = process.env.COGNEE_API_KEY;
  const serviceUrl = process.env.COGNEE_SERVICE_URL ?? "https://api.cognee.ai";

  if (!apiKey) {
    throw new CogneeMemoryUnavailableError(
      "Cognee memory is unavailable to the app runtime. Set COGNEE_API_KEY and COGNEE_SERVICE_URL, or run a local Cognee HTTP service.",
    );
  }

  const response = await fetch(new URL("/api/v1/remember", serviceUrl), {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: createRememberPinBody(pin),
  });

  if (!response.ok) {
    throw new CogneeMemoryUnavailableError(
      `Cognee memory returned ${response.status}. Retry when the service is available.`,
    );
  }
}

function createRememberPinBody(pin: Pin): FormData {
  const body = new FormData();

  body.set("datasetName", `clue-${pin.mysteryId}`);
  body.set("data", new Blob([formatPinMemory(pin)], { type: "text/plain" }), `${pin.id}.txt`);

  return body;
}

function formatPinMemory(pin: Pin): string {
  return [
    `Mystery ID: ${pin.mysteryId}`,
    `Pin ID: ${pin.id}`,
    `Pin text: ${pin.text}`,
  ].join("\n");
}
