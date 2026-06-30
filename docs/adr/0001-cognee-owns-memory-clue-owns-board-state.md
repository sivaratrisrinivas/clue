# Cognee owns memory; Clue owns board state

Clue uses Cognee as the system of record for memory and retrieval: pin text ingestion, context extraction, graph/vector memory, related-memory recall, and semantic relationship discovery. The Clue app owns board state: mystery title, pin IDs, pin positions, visual string rendering, selected state, manual connections, and explanation presentation. This keeps Cognee essential to the product's intelligence while keeping UI layout and interaction state inside the app where it can stay predictable and demoable.
