# Runtime Sub-agent Model Switching

This project does not support dedicated commands or runtime mechanisms to switch sub-agent models mid-session without restarting.

## Why this is out of scope

OpenCode already provides native runtime model switching for the active agent via the built-in `/model` command. When a user runs `/model`, OpenCode switches the session model immediately without a restart, and `oh-my-opencode-slim` preserves this selection across agent turns and reloads.

Extending runtime switching to individual delegated sub-agents (e.g. adding a `/set-model <agent> <model>` slash command or a per-turn model prompt) was proposed in issue #211. However:

- Sub-agent definitions and their model assignments are defined at startup in `oh-my-opencode-slim.json` / presets and loaded into the plugin config.
- Runtime state desynchronization: model changes must go through the host
  session manager (the plugin's own fallback path switches models via
  `session.switchModel` and session prompts for exactly this reason).
  Reassigning a sub-agent's model mid-flight through an ephemeral plugin hook
  bypasses that manager, leaving what the UI displays and what the session
  executes out of sync.
- The plugin already supports declarative model fallback chains (`model: ["primary", "fallback"]`) through `ForegroundFallbackManager`. Reactive model fallback on error is supported, but arbitrary user-directed mid-session model reassignment for background sub-agents is a platform-level concern that belongs in OpenCode core rather than custom slash commands in a slim orchestration layer.

If a user needs different models for different tasks, the supported pattern is switching presets (`/preset <name>`) or configuring fallback chains in `oh-my-opencode-slim.json`.

## The #211 close is conditional, not a durable rejection

The close on #211 explicitly framed per-subagent switching from the orchestrator as a *nice-to-have*, not a rejected idea — but said it was "blocked on making the TUI fallback system more robust first," with an explicit "happy to reopen" once that landed. That precondition has since been met: the TUI/foreground fallback robustness work has shipped (issues #955 and #1125 closed as completed, with merged PRs #1088, #1151, #1298, #1488, #1491, and #1511 hardening `ForegroundFallbackManager`). The main ask itself was closed because OpenCode's built-in `/model` command already covers runtime switching for the active agent. If per-subagent switching becomes a priority, this is a reopen candidate, not a settled rejection.

## Prior requests

- #211 — "[Feature Request] Runtime Model Switching for Agents (Terminal-based, No Restart)" (closed; per-subagent switching deferred pending fallback robustness — reopen offered once that landed, and it has)
