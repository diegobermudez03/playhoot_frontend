# @playhoot/game-core

What a game's server and client share: `defineCommands` and `defineInputs`, the field types of the backend manifest, and their conversion to it.

Bundled into both game artifacts. It runs in the backend sandbox, so it follows the compile profile `sdk-v1` (top level only functions and constants, no UI, no browser) and depends on nothing.
