"use client";

import React, { useEffect, useMemo, useState } from "react";

import type { BoardString, MysteryBoard, Pin } from "../board-state";
import {
  createSyntheticDemoRound,
  type DemoRoundQuery,
  type DemoRoundVerdict,
} from "../demo-round";

type BoardProps = {
  initialBoard: MysteryBoard;
};

type ActionMode =
  | "reveal"
  | "board-query"
  | "reconsider-board"
  | "manual-string"
  | "final"
  | "pin-detail";

export function Board({ initialBoard: _initialBoard }: BoardProps) {
  const round = useMemo(() => createSyntheticDemoRound(), []);
  const [board, setBoard] = useState(round.board);
  const [revealedPinIds, setRevealedPinIds] = useState<Set<string>>(
    () => new Set(round.startingPinIds),
  );
  const [visibleStringIds, setVisibleStringIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [manualStrings, setManualStrings] = useState<BoardString[]>([]);
  const [revealBatchIndex, setRevealBatchIndex] = useState(0);
  const [actionMode, setActionMode] = useState<ActionMode>("reveal");
  const [selectedQueryId, setSelectedQueryId] = useState(round.queries[0]?.id ?? "");
  const [boardQueryResult, setBoardQueryResult] =
    useState<DemoRoundQuery | null>(null);
  const [reconsiderBoardResult, setReconsiderBoardResult] =
    useState<string | null>(null);
  const [selectedStringId, setSelectedStringId] = useState<string | null>(null);
  const [manualStringStartPinId, setManualStringStartPinId] = useState<
    string | null
  >(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedVerdict, setSelectedVerdict] =
    useState<DemoRoundVerdict | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(round.durationSeconds);
  const [draggingPin, setDraggingPin] = useState<{
    pinId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draggingPin) {
      return;
    }

    function handleDragMove(event: MouseEvent | PointerEvent) {
      setDraggingPin((current) => {
        if (!current) {
          return current;
        }

        const nextX = current.startX + event.clientX - current.startClientX;
        const nextY = current.startY + event.clientY - current.startClientY;
        movePinLocally(current.pinId, nextX, nextY);

        return {
          ...current,
          x: nextX,
          y: nextY,
        };
      });
    }

    function handleDragEnd() {
      setDraggingPin(null);
    }

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd, { once: true });
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd, { once: true });

    return () => {
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("pointermove", handleDragMove);
      document.removeEventListener("pointerup", handleDragEnd);
    };
  }, [draggingPin]);

  const visibleBoard = useMemo(() => {
    const pins = board.pins.filter((pin) => revealedPinIds.has(pin.id));
    const pinIds = new Set(pins.map((pin) => pin.id));
    const strings = [...board.strings, ...manualStrings].filter(
      (string) =>
        visibleStringIds.has(string.id) &&
        pinIds.has(string.fromPinId) &&
        pinIds.has(string.toPinId),
    );

    return {
      ...board,
      pins,
      strings,
    };
  }, [board, manualStrings, revealedPinIds, visibleStringIds]);

  const selectedString =
    visibleBoard.strings.find((string) => string.id === selectedStringId) ?? null;
  const selectedPin =
    visibleBoard.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const manualStringStartPin = manualStringStartPinId
    ? visibleBoard.pins.find((pin) => pin.id === manualStringStartPinId)
    : null;
  const hasMorePins = revealBatchIndex < round.revealBatches.length;
  const progress = Math.round((revealedPinIds.size / board.pins.length) * 100);

  function revealNextBatch() {
    const batch = round.revealBatches[revealBatchIndex];
    if (!batch) {
      setActionMode("board-query");
      return;
    }

    setRevealedPinIds((current) => new Set([...current, ...batch]));
    setRevealBatchIndex((current) => current + 1);
    setSelectedPinId(null);
    setSelectedStringId(null);

    if (revealBatchIndex + 1 >= round.revealBatches.length) {
      setActionMode("reconsider-board");
    }
  }

  function askBoardQuery() {
    const query = round.queries.find((candidate) => candidate.id === selectedQueryId);
    if (!query) {
      return;
    }

    setBoardQueryResult(query);
  }

  function reconsiderBoard() {
    const revealableStringIds = round.reconsiderStringIds.filter((stringId) => {
      const string = board.strings.find((candidate) => candidate.id === stringId);
      return (
        string &&
        revealedPinIds.has(string.fromPinId) &&
        revealedPinIds.has(string.toPinId)
      );
    });

    setVisibleStringIds((current) => new Set([...current, ...revealableStringIds]));
    setReconsiderBoardResult(
      revealableStringIds.length === 1
        ? "1 new Clue surfaced"
        : `${revealableStringIds.length} new Clues surfaced`,
    );
    setActionMode("manual-string");
  }

  function chooseManualStringPin(pinId: string) {
    if (!manualStringStartPinId) {
      setManualStringStartPinId(pinId);
      return;
    }

    if (manualStringStartPinId === pinId) {
      setManualStringStartPinId(null);
      return;
    }

    const string = createManualString(manualStringStartPinId, pinId);
    setManualStrings((current) => [...current, string]);
    setVisibleStringIds((current) => new Set([...current, string.id]));
    setManualStringStartPinId(null);
    setActionMode("final");
  }

  function chooseActionMode(nextActionMode: ActionMode) {
    setActionMode(nextActionMode);
    setSelectedPinId(null);
    setSelectedStringId(null);

    if (nextActionMode !== "manual-string") {
      setManualStringStartPinId(null);
    }
  }

  function movePinLocally(pinId: string, x: number, y: number) {
    setBoard((current) => ({
      ...current,
      pins: current.pins.map((pin) =>
        pin.id === pinId ? { ...pin, x, y } : pin,
      ),
    }));
  }

  function startDraggingPin(pin: Pin, event: React.MouseEvent | React.PointerEvent) {
    if (actionMode === "manual-string") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    setDraggingPin({
      pinId: pin.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pin.x,
      startY: pin.y,
      x: pin.x,
      y: pin.y,
    });
  }

  return (
    <section aria-label="Investigation round" className="board-plane">
      <header className="board-toolbar">
        <div className="window-mark" aria-hidden="true" />
        <p className="app-name">Clue</p>
        <p className="restore-status">
          <span aria-hidden="true" />
          Synthetic round loaded
        </p>
      </header>

      <div className="board-stage">
        <div className="mystery-heading">
          <p className="round-kicker">4 minute Mystery</p>
          <h1>{board.mystery.title}</h1>
        </div>

        <div className="round-hud" aria-label="Round status">
          <p>{formatCountdown(secondsRemaining)}</p>
          <p>{`${visibleBoard.pins.length}/${board.pins.length} Pins revealed`}</p>
          <div aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div aria-label="Strings" className="string-layer">
          {visibleBoard.strings.map((string) => {
            const geometry = stringGeometry(string, visibleBoard.pins);
            if (!geometry) {
              return null;
            }

            return (
              <button
                key={string.id}
                type="button"
                aria-label={stringLabel(string, visibleBoard.pins)}
                className={`string-line ${stringClassName(string)}`}
                style={{
                  left: geometry.left,
                  top: geometry.top,
                  width: geometry.width,
                  transform: `rotate(${geometry.angle}rad)`,
                }}
                onClick={() => {
                  setSelectedStringId(string.id);
                  setSelectedPinId(null);
                }}
              />
            );
          })}
        </div>

        <ol aria-label="Pins" className="pin-list">
          {visibleBoard.pins.map((pin) => (
            <li
              key={pin.id}
              className={`pin ${
                manualStringStartPinId === pin.id ? "pin--string-start" : ""
              } ${selectedPinId === pin.id ? "pin--selected" : ""}`}
              style={{ left: pin.x, top: pin.y }}
              onClick={() => {
                if (actionMode === "manual-string") {
                  chooseManualStringPin(pin.id);
                  return;
                }

                setSelectedPinId(pin.id);
                setSelectedStringId(null);
                setActionMode("pin-detail");
              }}
              onMouseDown={(event) => startDraggingPin(pin, event)}
              onPointerDown={(event) => startDraggingPin(pin, event)}
            >
              <p>{pin.text}</p>
              <span>{memoryLabel(pin)}</span>
            </li>
          ))}
        </ol>

        {selectedString ? (
          <div
            aria-label="String explanation"
            aria-modal="false"
            className="string-explanation"
            role="dialog"
          >
            <button
              type="button"
              aria-label="Close String explanation"
              className="string-explanation__close"
              onClick={() => setSelectedStringId(null)}
            >
              x
            </button>
            <p className="string-explanation__type">
              {formatClueType(selectedString.clueType)}
            </p>
            <p>{pinText(selectedString.fromPinId, visibleBoard.pins)}</p>
            <p>{pinText(selectedString.toPinId, visibleBoard.pins)}</p>
            <p>{selectedString.explanation}</p>
            {selectedString.recalledMemory ? (
              <p>{selectedString.recalledMemory}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="action-dock">
        <nav aria-label="Round actions" className="action-switcher">
          <button
            type="button"
            aria-pressed={actionMode === "reveal"}
            onClick={() => chooseActionMode("reveal")}
          >
            Reveal
          </button>
          <button
            type="button"
            aria-pressed={actionMode === "board-query"}
            onClick={() => chooseActionMode("board-query")}
          >
            Query
          </button>
          <button
            type="button"
            aria-pressed={actionMode === "reconsider-board"}
            onClick={() => chooseActionMode("reconsider-board")}
          >
            Reconsider
          </button>
          <button
            type="button"
            aria-pressed={actionMode === "manual-string"}
            onClick={() => chooseActionMode("manual-string")}
          >
            String
          </button>
          <button
            type="button"
            aria-pressed={actionMode === "final"}
            onClick={() => chooseActionMode("final")}
          >
            Final
          </button>
        </nav>

        {actionMode === "reveal" ? (
          <div aria-label="Reveal Pins" className="action-panel reveal-panel">
            <p>
              {hasMorePins
                ? "The board is already loaded. Reveal the next evidence packet when you are ready."
                : "All Pins are on the board. Time to pressure-test the Mystery."}
            </p>
            <button type="button" onClick={revealNextBatch}>
              {hasMorePins ? "Reveal Evidence" : "Ask Board Query"}
            </button>
          </div>
        ) : null}

        {actionMode === "board-query" ? (
          <div aria-label="Board Query" className="action-panel board-query">
            <div className="query-options" role="group" aria-label="Board Query choices">
              {round.queries.map((query) => (
                <button
                  key={query.id}
                  type="button"
                  aria-pressed={selectedQueryId === query.id}
                  onClick={() => setSelectedQueryId(query.id)}
                >
                  {query.question}
                </button>
              ))}
            </div>
            <button type="button" onClick={askBoardQuery}>
              Ask Board Query
            </button>
            {boardQueryResult ? (
              <div aria-label="Board Query answer" className="board-query__answer">
                <p>{formatBoardQueryKind(boardQueryResult.queryKind)}</p>
                <p>{boardQueryResult.answer}</p>
                <p>{`Grounded in ${boardQueryResult.groundedPinIds.length} Pins`}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {actionMode === "reconsider-board" ? (
          <div className="action-panel reconsider-board">
            <p>Let Clue surface defensible Strings from the synthetic memory.</p>
            <button type="button" onClick={reconsiderBoard}>
              Reconsider Board
            </button>
            {reconsiderBoardResult ? (
              <p className="reconsider-board__status">{reconsiderBoardResult}</p>
            ) : null}
          </div>
        ) : null}

        {actionMode === "manual-string" ? (
          <div className="action-panel manual-string">
            {reconsiderBoardResult ? (
              <p className="reconsider-board__status">{reconsiderBoardResult}</p>
            ) : null}
            <p>
              {manualStringStartPin
                ? `String from ${manualStringStartPin.text}`
                : "Pick two Pins to make your investigator String."}
            </p>
            <button
              type="button"
              disabled={!manualStringStartPinId}
              onClick={() => setManualStringStartPinId(null)}
            >
              Cancel String
            </button>
          </div>
        ) : null}

        {actionMode === "final" ? (
          <div className="action-panel final-panel">
            <div className="verdict-options" role="group" aria-label="Final answer">
              {round.verdicts.map((verdict) => (
                <button
                  key={verdict.id}
                  type="button"
                  aria-pressed={selectedVerdict?.id === verdict.id}
                  onClick={() => setSelectedVerdict(verdict)}
                >
                  {verdict.label}
                </button>
              ))}
            </div>
            {selectedVerdict ? (
              <p
                className={
                  selectedVerdict.isCorrect
                    ? "final-panel__result final-panel__result--correct"
                    : "final-panel__result"
                }
              >
                {selectedVerdict.explanation}
              </p>
            ) : null}
          </div>
        ) : null}

        {actionMode === "pin-detail" && selectedPin ? (
          <div className="action-panel pin-detail">
            <p>{selectedPin.text}</p>
            <button type="button" onClick={() => chooseActionMode("manual-string")}>
              Use in String
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function createManualString(fromPinId: string, toPinId: string): BoardString {
  const now = new Date();

  return {
    id: `manual-${fromPinId}-${toPinId}-${now.getTime()}`,
    mysteryId: "canonical-party-mystery",
    fromPinId,
    toPinId,
    kind: "manual",
    source: "manual",
    clueType: "manual_connection",
    confidence: 1,
    stroke: "blue_dashed",
    explanation:
      "You manually connected these Pins as the human investigator in the loop.",
    recalledMemory: null,
    createdAt: now,
    updatedAt: now,
  };
}

function memoryLabel(pin: Pin): string {
  if (pin.memoryStatus === "remembering") {
    return "Remembering";
  }

  if (pin.memoryStatus === "memory_failed") {
    return "Memory failed";
  }

  return "Synthetic Pin";
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainder}`;
}

function stringGeometry(
  string: BoardString,
  pins: readonly Pin[],
): { left: number; top: number; width: number; angle: number } | null {
  const fromPin = pins.find((pin) => pin.id === string.fromPinId);
  const toPin = pins.find((pin) => pin.id === string.toPinId);

  if (!fromPin || !toPin) {
    return null;
  }

  const from = pinCenter(fromPin);
  const to = pinCenter(toPin);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    left: from.x,
    top: from.y,
    width: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
  };
}

function pinCenter(pin: Pin): { x: number; y: number } {
  return {
    x: pin.x + 110,
    y: pin.y + 66,
  };
}

function stringClassName(string: BoardString): string {
  if (string.stroke === "red_solid") {
    return "string-line--red-solid";
  }

  return "string-line--blue-dashed";
}

function stringLabel(string: BoardString, pins: readonly Pin[]): string {
  const source = string.source === "manual" ? "Manual" : "Cognee";

  return `${source} String between ${pinText(string.fromPinId, pins)} and ${pinText(
    string.toPinId,
    pins,
  )}`;
}

function pinText(pinId: string, pins: readonly Pin[]): string {
  return pins.find((pin) => pin.id === pinId)?.text ?? "Unknown Pin";
}

function formatClueType(clueType: BoardString["clueType"]): string {
  const label = clueType
    .split("_")
    .join(" ");

  return label[0].toUpperCase() + label.slice(1);
}

function formatBoardQueryKind(queryKind: DemoRoundQuery["queryKind"]): string {
  return {
    time_window: "Time window",
    entity_connections: "Entity connections",
    unresolved_leads: "Unresolved leads",
  }[queryKind];
}
