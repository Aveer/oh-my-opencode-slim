# Plugin-Side Agent & Prompt Hot-Reloading

This project does not implement plugin-level live reloading or file watching for structural agent definitions, system prompts, or tool rosters.

## Why this is out of scope

Issue #95 requested live editing of agents, sub-agents, and prompts without restarting OpenCode (e.g. tweaking orchestrator delegation prompts, editing agent instructions, or adding new sub-agents on the fly).

### What OpenCode v2 supports vs. what remains out of scope

OpenCode v2 introduced `ctx.agent.reload()` and `AgentDraft.update()` in `@opencode-ai/plugin` v2. On v2 hosts, `oh-my-opencode-slim` takes advantage of this for **runtime profiles only** (`src/v2/config-watch.ts` and `src/v2/runtime-profiles.ts`):

- When a user changes presets or edits `oh-my-opencode-slim.json`, the plugin hot-refreshes **inference fields** (models, variants, temperature, provider options) for **new child sessions** and updates the TUI sidebar projection without a restart.

However, hot-reloading **agent prompts, tools, routing rules, permissions, or structural rosters** remains strictly out of scope for architectural reasons:

1. **Prompt Cache Safety**: Provider prompt caches (Claude, OpenAI, Gemini) are exact byte-prefix matches over the rendered request (`tools → system → messages`). Any byte that changes in the system prompt or tool definitions invalidates the cache for all subsequent requests in that session, re-paying full input token cost and latency. Repository guidelines strictly mandate: *Keep system prompts and tool sets frozen for the lifetime of a session.*
2. **Session Consistency**: Actively running or resumed child sessions rely on immutable capabilities and role contracts. Mutating tool sets, permissions, or system prompts mid-session causes state desync and races between the orchestrator and delegated subagents. Per `src/v2/codemap.md`: *Definitions are registered exactly once — config changes never re-register or reload them.*
3. **Host Lifecycle Boundary**: In v1, `client.config.update()` disposes instances and the plugin function re-runs on bootstrap (`src/index.ts`), and on v2 hosts `src/v2/config-watch.ts` hot-refreshes inference fields for **new child sessions** — but existing sessions keep their prompts, tools, and captured models. Full structural reloading (refreshing the complete prompt text, tool bindings, and `@` agent catalog for live sessions) belongs to a clean host restart or host-level instance reload (such as OpenCode's native `/reload` slash command), not plugin-side mutable prompt watchers.

## Prior requests

- #95 — "Hot-reload / live editing of agents and orchestrator without reinstall" (closed as wontfix / blocked on upstream)
