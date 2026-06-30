# Use Neon for board state and Cognee for memory

Clue will store app-owned board state in Neon Postgres and use Cognee as the semantic memory system. Neon owns mysteries, pins, pin positions, manual strings, displayed clue strings, deletion state, explanation text, and timestamps; Cognee owns pin text ingestion, context extraction, graph/vector memory, related-memory recall, and semantic relationship discovery. This gives the deployed demo durable board state without duplicating Cognee's memory graph or making Postgres responsible for semantic retrieval.
