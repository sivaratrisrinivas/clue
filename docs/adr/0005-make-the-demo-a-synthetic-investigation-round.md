# Make the demo a synthetic Investigation Round

Clue will present the primary demo as a short synthetic Investigation Round instead of asking the user to type Pins before the product becomes useful. The round is prefilled with synthetic Pins, staged evidence reveals, prewritten Board Query choices, defensible Strings, a human-created manual String, and a final explanation choice.

This revises ADR-0002's judged demo shape from "add pins, remember, draw strings, explain strings" to "reveal pins, query memory, draw or inspect strings, choose the explanation." The underlying Pin, String, Board Query, Reconsider Board, Neon, and Cognee boundaries still stand; the change is the demo experience. This keeps Clue legible in a 3-5 minute session for users who will not provide high-quality evidence text upfront, while preserving the product's core promise that meaningful connections are surfaced from investigation memory.
