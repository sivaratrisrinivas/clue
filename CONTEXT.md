# Clue

Clue is an investigation board for collecting evidence fragments and surfacing meaningful connections between them. Its language distinguishes what the user adds from what the system discovers.

## Language

**Pin**:
A user-added evidence fragment on the board. A pin may contain text, extracted entities, an optional event time, and a board position.
_Avoid_: Note, card, clue

**Mystery**:
The investigation question that gives a board its purpose. The canonical demo mystery is "What happened at the party?"
_Avoid_: Project, case, workspace

**Investigation Loop**:
The core user-visible sequence after a pin is added: Pin, Remember, Connect. It describes the pin appearing, Cognee remembering it, and Clue surfacing related clues.
_Avoid_: Workflow, pipeline, ingestion flow

**Reconsider Board**:
An explicit user action that asks Clue to re-evaluate the whole mystery and surface defensible new strings. It is the MVP version of the later autonomous cold-case behavior.
_Avoid_: Cold mode, background scan, cron scan

**Board Query**:
A bounded question asked against the current mystery's pins and Cognee memory. It interrogates investigation memory and must not behave like a general chat assistant.
_Avoid_: Chat, chatbot, general assistant

**Clue**:
A meaningful connection or inference discovered between pins. A clue is evidence of a relationship, not the raw evidence fragment itself.
_Avoid_: Pin, string, edge

**Clue Type**:
The reason a clue exists. The MVP clue types are shared entity, temporal proximity, semantic relation, and manual connection.
_Avoid_: Connection type, edge type, relation type

**String**:
The visual representation of a clue or a manual user connection between two pins.
_Avoid_: Edge, link, connection line
