import type { ClueType, DiscoveredStringInput, Pin } from "./board-state";

export class CogneeMemoryUnavailableError extends Error {
  constructor(
    message = "Cognee memory is unavailable to the app runtime. Retry when the server adapter is configured.",
  ) {
    super(message);
    this.name = "CogneeMemoryUnavailableError";
  }
}

export async function rememberPinWithCognee(
  pin: Pin,
  currentMysteryPins: readonly Pin[] = [pin],
): Promise<DiscoveredStringInput[]> {
  const apiKey = envValue("COGNEE_API_KEY");
  const serviceUrl =
    envValue("COGNEE_BASE_URL") ??
    envValue("COGNEE_SERVICE_URL") ??
    "https://api.cognee.ai";

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

  const rememberedClues = parseDefensibleClues(
    await readJson(response),
    currentMysteryPins,
  );
  const recalledClues = await recallDiscoveredClues({
    apiKey,
    currentMysteryPins,
    pin,
    serviceUrl,
  });

  return [...rememberedClues, ...recalledClues];
}

function createRememberPinBody(pin: Pin): FormData {
  const body = new FormData();

  body.set("datasetName", `clue-${pin.mysteryId}`);
  body.set("data", new Blob([formatPinMemory(pin)], { type: "text/plain" }), `${pin.id}.txt`);

  return body;
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function formatPinMemory(pin: Pin): string {
  return [
    `Mystery ID: ${pin.mysteryId}`,
    `Pin ID: ${pin.id}`,
    `Pin text: ${pin.text}`,
  ].join("\n");
}

async function recallDiscoveredClues({
  apiKey,
  currentMysteryPins,
  pin,
  serviceUrl,
}: {
  apiKey: string;
  currentMysteryPins: readonly Pin[];
  pin: Pin;
  serviceUrl: string;
}): Promise<DiscoveredStringInput[]> {
  const candidatePins = currentMysteryPins.filter(
    (candidate) => candidate.id !== pin.id,
  );

  if (candidatePins.length === 0) {
    return [];
  }

  const response = await fetch(new URL("/api/v1/recall", serviceUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      datasets: [`clue-${pin.mysteryId}`],
      includeReferences: true,
      query: createRecallQuery(pin, candidatePins),
      searchType: "GRAPH_COMPLETION",
      topK: 5,
    }),
  });

  if (!response.ok) {
    throw new CogneeMemoryUnavailableError(
      `Cognee recall returned ${response.status}. Retry when the service is available.`,
    );
  }

  return parseDefensibleClues(
    extractRecallCandidates(await readJson(response)),
    currentMysteryPins,
  );
}

function createRecallQuery(pin: Pin, candidatePins: readonly Pin[]): string {
  return [
    "You are helping Clue draw defensible investigation board Strings.",
    "Compare the new Pin with each candidate Pin using only Cognee memory from this dataset.",
    "A Clue is defensible when Cognee recalls both Pin texts and can cite a concrete shared entity, close event time, or meaningful semantic relation.",
    "Use temporal_proximity when two remembered events happen within a close time window.",
    "Use shared_entity when both remembered Pins name the same concrete person, place, object, or organization.",
    "Use semantic_relation when one remembered Pin explains, contradicts, causes, or contextualizes the other.",
    `New Pin ID: ${pin.id}`,
    `New Pin text: ${pin.text}`,
    "Candidate Pins:",
    ...candidatePins.map(
      (candidate) => `Pin ID: ${candidate.id}\nPin text: ${candidate.text}`,
    ),
    "Return only JSON with this exact shape:",
    '{"clues":[{"fromPinId":"new-or-candidate-pin-id","toPinId":"new-or-candidate-pin-id","clueType":"shared_entity|temporal_proximity|semantic_relation","confidence":0.0,"explanation":"concise defensible reason","recalledMemory":"what Cognee recalled"}]}',
    "Set confidence between 0.65 and 1 for clear remembered evidence.",
    'Return {"clues":[]} only when the relationship is weak, vague, or explanation-free.',
  ].join("\n");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function parseDefensibleClues(
  body: unknown,
  currentMysteryPins: readonly Pin[],
): DiscoveredStringInput[] {
  if (!isRecord(body) || !Array.isArray(body.clues)) {
    return [];
  }

  const currentPinIds = new Set(currentMysteryPins.map((pin) => pin.id));

  return body.clues.flatMap((candidate) => {
    if (!isRecord(candidate)) {
      return [];
    }

    const fromPinId = stringValue(candidate.fromPinId);
    const toPinId = stringValue(candidate.toPinId);
    const clueType = clueTypeValue(candidate.clueType);
    const confidence = numberValue(candidate.confidence);
    const explanation = stringValue(candidate.explanation).trim();
    const recalledMemory = stringValue(candidate.recalledMemory).trim();

    if (
      !fromPinId ||
      !toPinId ||
      fromPinId === toPinId ||
      !currentPinIds.has(fromPinId) ||
      !currentPinIds.has(toPinId) ||
      !clueType ||
      confidence === undefined ||
      confidence < 0.65 ||
      confidence > 1 ||
      !explanation
    ) {
      return [];
    }

    return [
      {
        fromPinId,
        toPinId,
        clueType,
        confidence,
        explanation,
        recalledMemory: recalledMemory || null,
      },
    ];
  });
}

function extractRecallCandidates(body: unknown): unknown {
  if (!Array.isArray(body)) {
    return body;
  }

  for (const entry of body) {
    const json = parseJsonObjectFromText(recallEntryText(entry));
    if (json) {
      return json;
    }
  }

  return {};
}

function recallEntryText(entry: unknown): string {
  if (!isRecord(entry)) {
    return "";
  }

  const raw = isRecord(entry.raw) ? stringValue(entry.raw.value) : "";
  return [stringValue(entry.text), stringValue(entry.content), raw]
    .filter(Boolean)
    .join("\n");
}

function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const jsonStart = trimmed.indexOf("{");
  if (jsonStart === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(jsonStart, index + 1)) as unknown;
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function clueTypeValue(value: unknown): DiscoveredStringInput["clueType"] | undefined {
  const clueType = stringValue(value) as ClueType;

  if (
    clueType === "shared_entity" ||
    clueType === "temporal_proximity" ||
    clueType === "semantic_relation"
  ) {
    return clueType;
  }

  return undefined;
}
