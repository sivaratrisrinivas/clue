import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CogneeMemoryUnavailableError,
  queryBoardWithCognee,
  reconsiderBoardWithCognee,
  rememberPinWithCognee,
} from "../src/cognee-memory";
import type { MysteryBoard, Pin } from "../src/board-state";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Cognee memory", () => {
  it("requires a server-side Cognee API key before remembering a Pin", async () => {
    vi.stubEnv("COGNEE_API_KEY", "");

    await expect(rememberPinWithCognee(testPin())).rejects.toBeInstanceOf(
      CogneeMemoryUnavailableError,
    );
  });

  it("sends Pin text to Cognee's server-side remember endpoint", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_SERVICE_URL", "https://cognee.example.test");
    vi.stubEnv("COGNEE_BASE_URL", "");
    const fetch = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    const clues = await rememberPinWithCognee(testPin());

    expect(fetch).toHaveBeenCalledWith(
      new URL("/api/v1/remember", "https://cognee.example.test"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "X-Api-Key": "test-cognee-key",
        },
        body: expect.any(FormData),
      }),
    );

    const body = fetch.mock.calls[0][1].body as FormData;
    expect(body.get("datasetName")).toBe("clue-canonical-party-mystery");
    const uploadedPin = body.get("data");
    expect(uploadedPin).toBeInstanceOf(Blob);
    expect((uploadedPin as File).name).toBe("pin-kim-left.txt");
    expect(clues).toEqual([]);
  });

  it("prefers the tenant Cognee base URL when both URL env vars are set", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_SERVICE_URL", "https://api.cognee.example.test");
    vi.stubEnv("COGNEE_BASE_URL", "https://tenant.cognee.example.test");
    const fetch = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await rememberPinWithCognee(testPin());

    expect(fetch).toHaveBeenCalledWith(
      new URL("/api/v1/remember", "https://tenant.cognee.example.test"),
      expect.anything(),
    );
  });

  it("returns defensible Cognee-discovered Clues from the remember response", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    const fetch = vi
      .fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({
          clues: [
            {
              fromPinId: "pin-kim-left",
              toPinId: "pin-receipt",
              clueType: "temporal_proximity",
              confidence: 0.82,
              explanation:
                "Cognee recalled both Pins in the same late-night time window.",
              recalledMemory:
                "Kim leaving around midnight is near the Lucky Star receipt.",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal("fetch", fetch);

    await expect(
      rememberPinWithCognee(testPin(), [
        testPin(),
        {
          ...testPin(),
          id: "pin-receipt",
          text: "Lucky Star receipt at 12:43 AM",
        },
      ]),
    ).resolves.toEqual([
      {
        fromPinId: "pin-kim-left",
        toPinId: "pin-receipt",
        clueType: "temporal_proximity",
        confidence: 0.82,
        explanation:
          "Cognee recalled both Pins in the same late-night time window.",
        recalledMemory:
          "Kim leaving around midnight is near the Lucky Star receipt.",
      },
    ]);
  });

  it("recalls defensible Clues from Cognee graph-completion JSON", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_BASE_URL", "https://tenant.cognee.example.test");
    const fetch = vi
      .fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        Response.json([
          {
            source: "graph",
            text: [
              "```json",
              JSON.stringify({
                clues: [
                  {
                    fromPinId: "pin-kim-left",
                    toPinId: "pin-receipt",
                    clueType: "temporal_proximity",
                    confidence: 0.83,
                    explanation:
                      "Cognee recalled both Pins in the same late-night window.",
                    recalledMemory:
                      "Kim leaving around midnight and the receipt at 12:43 AM are close in time.",
                  },
                ],
              }),
              "```",
              "Evidence: remembered chunks.",
            ].join("\n"),
            raw: {
              value: [
                "```json",
                JSON.stringify({ clues: [] }),
                "```",
                "Evidence: duplicate raw response.",
              ].join("\n"),
            },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetch);

    const clues = await rememberPinWithCognee(testPin(), [
      testPin(),
      {
        ...testPin(),
        id: "pin-receipt",
        text: "Lucky Star receipt at 12:43 AM",
      },
    ]);

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      new URL("/api/v1/recall", "https://tenant.cognee.example.test"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": "test-cognee-key",
        },
      }),
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body as string)).toMatchObject({
      datasets: ["clue-canonical-party-mystery"],
      searchType: "GRAPH_COMPLETION",
      topK: 5,
    });
    expect(clues).toEqual([
      {
        fromPinId: "pin-kim-left",
        toPinId: "pin-receipt",
        clueType: "temporal_proximity",
        confidence: 0.83,
        explanation:
          "Cognee recalled both Pins in the same late-night window.",
        recalledMemory:
          "Kim leaving around midnight and the receipt at 12:43 AM are close in time.",
      },
    ]);
  });

  it("filters weak or explanation-free Cognee recall results", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    const fetch = vi
      .fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({
          clues: [
            {
              fromPinId: "pin-kim-left",
              toPinId: "pin-receipt",
              clueType: "semantic_relation",
              confidence: 0.42,
              explanation: "Maybe related.",
            },
            {
              fromPinId: "pin-kim-left",
              toPinId: "pin-receipt",
              clueType: "temporal_proximity",
              confidence: 0.9,
              explanation: "",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal("fetch", fetch);

    await expect(
      rememberPinWithCognee(testPin(), [
        testPin(),
        {
          ...testPin(),
          id: "pin-receipt",
          text: "Lucky Star receipt at 12:43 AM",
        },
      ]),
    ).resolves.toEqual([]);
  });

  it("reports Cognee failures without fabricating memory success", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("conflict", { status: 409 })),
    );

    await expect(rememberPinWithCognee(testPin())).rejects.toThrow(
      "Cognee memory returned 409",
    );
  });

  it("asks Cognee a bounded Board Query against the current Mystery dataset", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_BASE_URL", "https://tenant.cognee.example.test");
    const fetch = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(
      async () =>
        Response.json([
          {
            text: JSON.stringify({
              answer:
                "Kim left around midnight and the receipt printed at 12:43 AM.",
              groundedPinIds: [
                "pin-kim-left",
                "pin-receipt",
                "pin-other-mystery",
              ],
              queryKind: "time_window",
            }),
          },
        ]),
    );
    vi.stubGlobal("fetch", fetch);

    const answer = await queryBoardWithCognee(
      "What happened between midnight and 1 AM?",
      testBoard(),
    );

    expect(fetch).toHaveBeenCalledWith(
      new URL("/api/v1/recall", "https://tenant.cognee.example.test"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": "test-cognee-key",
        },
      }),
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      datasets: ["clue-canonical-party-mystery"],
      includeReferences: true,
      searchType: "GRAPH_COMPLETION",
      topK: 8,
    });
    expect(body.query).toContain(
      "Supported Board Query kinds are time_window, entity_connections, and unresolved_leads.",
    );
    expect(body.query).toContain("Pin ID: pin-kim-left");
    expect(body.query).toContain("Pin ID: pin-receipt");
    expect(answer).toEqual({
      answer: "Kim left around midnight and the receipt printed at 12:43 AM.",
      groundedPinIds: ["pin-kim-left", "pin-receipt"],
      queryKind: "time_window",
    });
  });

  it("reports unavailable Cognee Board Query memory without inventing an answer", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    await expect(
      queryBoardWithCognee("What are the strongest unresolved leads?", testBoard()),
    ).rejects.toThrow("Cognee Board Query returned 503");
  });

  it("asks Cognee to Reconsider Board against the whole current Mystery", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_BASE_URL", "https://tenant.cognee.example.test");
    const fetch = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(
      async () =>
        Response.json([
          {
            text: JSON.stringify({
              clues: [
                {
                  fromPinId: "pin-kim-left",
                  toPinId: "pin-receipt",
                  clueType: "temporal_proximity",
                  confidence: 0.88,
                  explanation:
                    "Cognee recalled both Pins in the same late-night window.",
                  recalledMemory:
                    "Kim left around midnight and the receipt printed at 12:43 AM.",
                },
              ],
            }),
          },
        ]),
    );
    vi.stubGlobal("fetch", fetch);

    const clues = await reconsiderBoardWithCognee(testBoard());

    expect(fetch).toHaveBeenCalledWith(
      new URL("/api/v1/recall", "https://tenant.cognee.example.test"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": "test-cognee-key",
        },
      }),
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      datasets: ["clue-canonical-party-mystery"],
      includeReferences: true,
      searchType: "GRAPH_COMPLETION",
      topK: 10,
    });
    expect(body.query).toContain("Reconsider Board");
    expect(body.query).toContain("Pin ID: pin-kim-left");
    expect(body.query).toContain("Pin ID: pin-receipt");
    expect(body.query).toContain("Do not invent vague Strings.");
    expect(clues).toEqual([
      {
        fromPinId: "pin-kim-left",
        toPinId: "pin-receipt",
        clueType: "temporal_proximity",
        confidence: 0.88,
        explanation:
          "Cognee recalled both Pins in the same late-night window.",
        recalledMemory:
          "Kim left around midnight and the receipt printed at 12:43 AM.",
      },
    ]);
  });
});

function testPin(): Pin {
  return {
    id: "pin-kim-left",
    mysteryId: "canonical-party-mystery",
    text: "Kim left around midnight",
    x: 120,
    y: 140,
    memoryStatus: "remembering",
    memoryError: null,
    deletedAt: null,
  };
}

function testBoard(): MysteryBoard {
  return {
    mystery: {
      id: "canonical-party-mystery",
      title: "What happened at the party?",
    },
    pins: [
      testPin(),
      {
        ...testPin(),
        id: "pin-receipt",
        text: "Lucky Star receipt printed at 12:43 AM",
      },
    ],
    strings: [],
    events: [],
  };
}
