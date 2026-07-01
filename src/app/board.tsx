"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { BoardString, MysteryBoard, Pin } from "../board-state";

type BoardProps = {
  initialBoard: MysteryBoard;
};

export function Board({ initialBoard }: BoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [text, setText] = useState("");
  const [selectedStringId, setSelectedStringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const rememberingPins = board.pins.filter(
      (pin) => pin.memoryStatus === "remembering",
    );

    for (const pin of rememberingPins) {
      void rememberPin(pin.id);
    }
  }, [board.pins]);

  function addPin() {
    const pinText = text.trim();
    if (!pinText) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pinText }),
      });

      if (!response.ok) {
        return;
      }

      const pin = (await response.json()) as Pin;
      setBoard((current) => ({
        ...current,
        pins: [...current.pins, pin],
      }));
      setText("");
    });
  }

  async function rememberPin(pinId: string) {
    const response = await fetch(`/api/pins/${pinId}/remember`, {
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    const refreshedBoard = (await response.json()) as MysteryBoard;
    setBoard(refreshedBoard);
  }

  const selectedString =
    board.strings.find((string) => string.id === selectedStringId) ?? null;

  return (
    <section aria-label="Investigation board" className="board-plane">
      <header className="board-toolbar">
        <div className="window-mark" aria-hidden="true" />
        <p className="app-name">Clue</p>
        <p className="restore-status">
          <span aria-hidden="true" />
          Board state restored
        </p>
      </header>

      <div className="mystery-heading">
        <h1>{board.mystery.title}</h1>
      </div>

      <form
        aria-label="Add Pin"
        className="pin-composer"
        onSubmit={(event) => {
          event.preventDefault();
          addPin();
        }}
      >
        <textarea
          aria-label="Pin text"
          name="text"
          placeholder="Add evidence..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" disabled={isPending || !text.trim()}>
          Add Pin
        </button>
      </form>

      {board.pins.length === 0 ? (
        <div className="empty-board-note">
          <div className="empty-pin-outline" aria-hidden="true" />
          <p>No Pins yet</p>
        </div>
      ) : (
        <>
          <div aria-label="Strings" className="string-layer">
            {board.strings.map((string) => {
              const geometry = stringGeometry(string, board.pins);
              if (!geometry) {
                return null;
              }

              return (
                <button
                  key={string.id}
                  type="button"
                  aria-label={stringLabel(string, board.pins)}
                  className={`string-line ${stringClassName(string)}`}
                  style={{
                    left: geometry.left,
                    top: geometry.top,
                    width: geometry.width,
                    transform: `rotate(${geometry.angle}rad)`,
                  }}
                  onClick={() => setSelectedStringId(string.id)}
                />
              );
            })}
          </div>

          <ol aria-label="Pins" className="pin-list">
            {board.pins.map((pin) => (
              <li
                key={pin.id}
                className="pin"
                style={{ left: pin.x, top: pin.y }}
              >
                <p>{pin.text}</p>
                <span>{memoryLabel(pin)}</span>
                {pin.memoryStatus === "memory_failed" ? (
                  <button type="button" onClick={() => void rememberPin(pin.id)}>
                    Retry memory
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}

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
          <p>{pinText(selectedString.fromPinId, board.pins)}</p>
          <p>{pinText(selectedString.toPinId, board.pins)}</p>
          <p>{selectedString.explanation}</p>
          {selectedString.recalledMemory ? (
            <p>{selectedString.recalledMemory}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function memoryLabel(pin: Pin): string {
  if (pin.memoryStatus === "remembering") {
    return "Remembering";
  }

  if (pin.memoryStatus === "memory_failed") {
    return "Memory failed";
  }

  return "Ready for connection work";
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
  return `Cognee String between ${pinText(string.fromPinId, pins)} and ${pinText(
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
