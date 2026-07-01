import type { BoardString, MysteryBoard, Pin } from "./board-state";

export type DemoRoundQuery = {
  id: string;
  question: string;
  answer: string;
  groundedPinIds: string[];
  queryKind: "time_window" | "entity_connections" | "unresolved_leads";
};

export type DemoRoundVerdict = {
  id: string;
  label: string;
  explanation: string;
  isCorrect: boolean;
};

export type DemoRound = {
  board: MysteryBoard;
  startingPinIds: string[];
  revealBatches: string[][];
  reconsiderStringIds: string[];
  queries: DemoRoundQuery[];
  verdicts: DemoRoundVerdict[];
  durationSeconds: number;
};

const mysteryId = "canonical-party-mystery";
const createdAt = new Date("2026-07-02T00:00:00.000Z");

export function createSyntheticDemoRound(): DemoRound {
  const pins: Pin[] = [
    pin(
      "pin-invite",
      "Party invite says the rooftop toast was scheduled for 11:45 PM.",
      92,
      128,
    ),
    pin(
      "pin-kim-text",
      "Kim texted Maya at 11:52 PM: \"Cover for me. I need ten minutes.\"",
      388,
      122,
    ),
    pin(
      "pin-camera",
      "Lobby camera missed twelve minutes after a breaker trip at 11:58 PM.",
      696,
      152,
    ),
    pin(
      "pin-receipt",
      "Lucky Star receipt: two coffees paid in cash at 12:43 AM.",
      1004,
      116,
    ),
    pin(
      "pin-doorman",
      "Doorman saw Kim return through the service lift at 12:31 AM.",
      214,
      358,
    ),
    pin(
      "pin-keycard",
      "Spare keycard used on the studio door at 12:07 AM.",
      552,
      380,
    ),
    pin(
      "pin-voicemail",
      "Voicemail from Theo: \"The photos are gone. Check Kim's camera bag.\"",
      870,
      348,
    ),
    pin(
      "pin-photo",
      "Recovered photo shows the missing flash drive taped under the DJ booth.",
      1160,
      356,
    ),
  ];

  const strings: BoardString[] = [
    string({
      id: "string-kim-window",
      fromPinId: "pin-kim-text",
      toPinId: "pin-doorman",
      clueType: "temporal_proximity",
      confidence: 0.88,
      explanation:
        "Kim asked for ten minutes, then reappeared through a quiet route inside the same window.",
      recalledMemory:
        "The text and service-lift sighting both place Kim away from the party shortly after midnight.",
    }),
    string({
      id: "string-camera-keycard",
      fromPinId: "pin-camera",
      toPinId: "pin-keycard",
      clueType: "temporal_proximity",
      confidence: 0.81,
      explanation:
        "The camera outage created cover for the spare keycard use nine minutes later.",
      recalledMemory:
        "The breaker trip and studio-door access sit in the same missing-footage interval.",
    }),
    string({
      id: "string-voicemail-photo",
      fromPinId: "pin-voicemail",
      toPinId: "pin-photo",
      clueType: "semantic_relation",
      confidence: 0.9,
      explanation:
        "Theo's voicemail points to missing photos, and the recovered photo exposes where the flash drive was hidden.",
      recalledMemory:
        "Both Pins concern the vanished camera evidence and the hidden flash drive.",
    }),
    string({
      id: "string-kim-keycard",
      fromPinId: "pin-kim-text",
      toPinId: "pin-keycard",
      clueType: "shared_entity",
      confidence: 0.77,
      explanation:
        "Kim's request for cover aligns with the unexplained spare keycard use.",
      recalledMemory:
        "The strongest unresolved lead is whether Kim used or arranged the spare keycard access.",
    }),
  ];

  return {
    board: {
      mystery: {
        id: mysteryId,
        title: "Who hid the flash drive after the party?",
      },
      pins,
      strings,
      events: [],
    },
    startingPinIds: ["pin-invite", "pin-kim-text", "pin-camera", "pin-receipt"],
    revealBatches: [
      ["pin-doorman", "pin-keycard"],
      ["pin-voicemail", "pin-photo"],
    ],
    reconsiderStringIds: [
      "string-kim-window",
      "string-camera-keycard",
      "string-voicemail-photo",
    ],
    queries: [
      {
        id: "query-midnight-window",
        question: "What happened between 11:50 PM and 12:35 AM?",
        answer:
          "Kim asked Maya to cover for her, the lobby camera went dark, a spare keycard opened the studio, and Kim returned by service lift before the receipt appears later.",
        groundedPinIds: [
          "pin-kim-text",
          "pin-camera",
          "pin-keycard",
          "pin-doorman",
        ],
        queryKind: "time_window",
      },
      {
        id: "query-kim",
        question: "Which Pins put pressure on Kim?",
        answer:
          "Kim's text, the service-lift return, and the spare keycard access form the strongest chain. The chain is suspicious, but not proof without the hidden-drive photo.",
        groundedPinIds: ["pin-kim-text", "pin-doorman", "pin-keycard"],
        queryKind: "entity_connections",
      },
      {
        id: "query-unresolved",
        question: "What is the most important unresolved lead?",
        answer:
          "The unresolved lead is whether the missing photos and recovered DJ-booth photo explain why someone needed the studio door opened during the camera outage.",
        groundedPinIds: [
          "pin-camera",
          "pin-keycard",
          "pin-voicemail",
          "pin-photo",
        ],
        queryKind: "unresolved_leads",
      },
    ],
    verdicts: [
      {
        id: "kim-hid-drive",
        label: "Kim hid the flash drive under the DJ booth.",
        explanation:
          "Correct. The tightest explanation connects Kim's cover text, the camera outage, spare keycard use, service-lift return, and the recovered photo.",
        isCorrect: true,
      },
      {
        id: "theo-framed-kim",
        label: "Theo framed Kim after finding the photos.",
        explanation:
          "Tempting, but Theo's voicemail points investigators toward the missing evidence instead of hiding the strongest lead.",
        isCorrect: false,
      },
      {
        id: "receipt-proves-alibi",
        label: "The Lucky Star receipt proves Kim was away.",
        explanation:
          "Not enough. The receipt is after the keycard window and after the doorman saw Kim return.",
        isCorrect: false,
      },
    ],
    durationSeconds: 240,
  };
}

function pin(id: string, text: string, x: number, y: number): Pin {
  return {
    id,
    mysteryId,
    text,
    x,
    y,
    memoryStatus: "ready_for_connection",
    memoryError: null,
    deletedAt: null,
  };
}

function string(input: {
  id: string;
  fromPinId: string;
  toPinId: string;
  clueType: BoardString["clueType"];
  confidence: number;
  explanation: string;
  recalledMemory: string;
}): BoardString {
  return {
    id: input.id,
    mysteryId,
    fromPinId: input.fromPinId,
    toPinId: input.toPinId,
    kind: "discovered",
    source: "cognee",
    clueType: input.clueType,
    confidence: input.confidence,
    stroke: "red_solid",
    explanation: input.explanation,
    recalledMemory: input.recalledMemory,
    createdAt,
    updatedAt: createdAt,
  };
}
