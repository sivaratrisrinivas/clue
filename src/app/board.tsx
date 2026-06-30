"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { MysteryBoard, Pin } from "../board-state";

type BoardProps = {
  initialBoard: MysteryBoard;
};

export function Board({ initialBoard }: BoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [text, setText] = useState("");
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

    const updatedPin = (await response.json()) as Pin;
    setBoard((current) => ({
      ...current,
      pins: current.pins.map((pin) =>
        pin.id === updatedPin.id ? updatedPin : pin,
      ),
    }));
  }

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
      )}
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
