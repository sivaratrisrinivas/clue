import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CogneeMemoryUnavailableError,
  rememberPinWithCognee,
} from "../src/cognee-memory";
import type { Pin } from "../src/board-state";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Cognee memory", () => {
  it("requires a server-side Cognee API key before remembering a Pin", async () => {
    await expect(rememberPinWithCognee(testPin())).rejects.toBeInstanceOf(
      CogneeMemoryUnavailableError,
    );
  });

  it("sends Pin text to Cognee's server-side remember endpoint", async () => {
    vi.stubEnv("COGNEE_API_KEY", "test-cognee-key");
    vi.stubEnv("COGNEE_SERVICE_URL", "https://cognee.example.test");
    const fetch = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await rememberPinWithCognee(testPin());

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
