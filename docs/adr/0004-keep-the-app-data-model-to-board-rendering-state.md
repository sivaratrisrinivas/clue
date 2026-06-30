# Keep the app data model to board rendering state

Clue's MVP data model will use four app-owned tables: mysteries, pins, strings, and events. The schema stores what the app needs to render and replay the board, including pin text, positions, deletion state, visual strings, explanations, and demo timeline events. It deliberately excludes entities, graph nodes, embeddings, and semantic relationship tables because those belong in Cognee's memory layer.
