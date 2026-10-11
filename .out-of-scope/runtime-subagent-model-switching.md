# Runtime Sub-agent Model Switching

This project does not support dedicated commands or runtime mechanisms to switch sub-agent models mid-session without restarting.

## Why this is out of scope

OpenCode already provides native runtime model switching for the active agent via the built-in `/model` command. When a user runs `/model`, OpenCode switches the session model immediately without a restart, and `oh-my-opencode-slim` preserves this selection across agent turns and reloads.

Extending runtime switching to individual delegated sub-agents (e.g. adding a `/set-model <agent> <model>` slash command or a per-turn model prompt) was proposed in issue #211. However:

- Sub-agent definitions and their model assignments are defined at startup in `oh-my-opencode-slim.json` / presets and loaded into the plugin config.
- Runtime state desynchronization: OpenCode core separates TUI display state from ACP session state (`session.variant` / `session.model`). Modifying a sub-agent's model mid-flight via an ephemeral plugin hook bypasses the host session manager, leading to desyncs between what the TUI displays and what the ACP session executes.
- The plugin already supports declarative model fallback chains (`model: ["primary", "fallback"]`) through `ForegroundFallbackManager`. Reactive model fallback on error is supported, but arbitrary user-directed mid-session model reassignment for background sub-agents is a platform-level concern that belongs in OpenCode core rather than custom slash commands in a slim orchestration layer.

If a user needs different models for different tasks, the supported pattern is switching presets (`/preset <name>`) or configuring fallback chains in `oh-my-opencode-slim.json`.

## Prior requests

- #211 — "[Feature Request] Runtime Model Switching for Agents (Terminal-based, No Restart)" (closed as wontfix)
