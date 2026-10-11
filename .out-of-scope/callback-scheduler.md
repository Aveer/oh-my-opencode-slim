# Plugin Clock Scheduler & Recurring Background Callbacks

This project does not implement a clock-based interval scheduler or cron system for recurring agent callbacks.

## Why this is out of scope

Issue #470 and Discussion #971 requested the ability for the orchestrator or plugin to schedule minute- or hour-based callbacks (e.g. recurring status checks or timed follow-ups).

The plugin architecture is strictly reactive and event-driven:

- OpenCode plugin hooks fire on explicit lifecycle events: user input, model response chunks, tool executions, and subagent state transitions.
- The plugin does not run a persistent background daemon outside of active OpenCode sessions.
- Adding a time-based scheduler introduces significant lifecycle and resource challenges: persisting scheduled jobs across restarts, waking idle sessions, racing with user prompts, and busting prompt cache prefixes on unexpected wake events.

Autonomous scheduling over long time horizons belongs at the host runtime level (OpenCode scheduler features) or via external system automation (cron jobs, CI pipelines, or CLI scripts invoking `opencode run`).

## Prior requests

- #470 — "[Feature]: Callbacks" (moved to discussion; closed)
- Discussion #971 — "[Feature]: Callbacks" (out of scope)
