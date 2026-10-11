# Plugin-Side Agent & Prompt Hot-Reloading

This project does not implement plugin-level live reloading or file watching for agent configurations and prompts.

## Why this is out of scope

Agent definitions, tools, and system prompts are compiled and bundled into `dist/index.js`, registered synchronously once during OpenCode's plugin initialization phase (`src/index.ts`, `src/agents/index.ts`).

Adding live hot-reloading (watching `oh-my-opencode-slim.json` or custom prompt files and updating agent definitions without restarting OpenCode) faces hard technical barriers in OpenCode's plugin architecture:

- OpenCode's plugin SDK (`@opencode-ai/plugin`) provides no hook for partial agent re-registration or dynamic agent schema updates.
- The only reload path available to plugins (`client.config.update()`) disposes the existing instance without re-executing the full plugin bootstrap that registers agents, causing custom agents to vanish from the autocomplete list.
- Mutating system prompts mid-session violates prompt-cache stability. Any modification to an active session's system prompt or toolset invalidates provider prefix caches across all subsequent turns.

Proper instance reloading must be handled upstream by OpenCode core (such as native `/reload` slash commands that re-instantiate plugin processes cleanly, tracked in `anomalyco/opencode#9871` and `#8751`). The plugin will not monkey-patch file watchers or mutable prompt caches to work around host lifecycle boundaries.

## Prior requests

- #95 — "Hot-reload / live editing of agents and orchestrator without reinstall" (closed as wontfix / blocked on upstream)
