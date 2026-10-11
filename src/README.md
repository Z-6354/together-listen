# together-listen v2 source structure

This directory is the new architecture migration workspace.

Migration principles:

- Keep the existing production entry point stable.
- Migrate modules incrementally.
- Maintain backward compatibility during transition.
- Each migration step should be independently testable.

Planned modules:

- config
- room
- playback
- user
- music
- playlist
- storage
- websocket
