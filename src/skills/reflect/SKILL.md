---
name: reflect
description: Review recent work, find repeated workflow patterns, and suggest reusable skills, agents, commands, config changes, or playbooks. Use when the user asks to learn from past sessions, improve recurring workflows, or identify what should be turned into reusable agent instructions.
---

# Reflect

Reflect is an orchestrator-only workflow for learning from repeated work. It
looks back over recent sessions, project notes, and existing agent assets, then
recommends the smallest useful improvement: a skill, custom agent, command,
configuration change, prompt rule, documentation playbook, or no change.

The goal is to identify real repeated friction and suggest practical improvements with evidence.

Branch: lines marked [branch: --sessions] run only with that flag; plain /reflect skips Session Mode.

## When to Use

Use Reflect when the user asks to:

- run `/reflect` or `/reflect <focus>`;
- run `/reflect --sessions` for session archaeology;
- learn from recent sessions or repeated workflows;
- find work they keep doing manually;
- improve their oh-my-opencode-slim setup based on actual usage using oh-my-opencode-slim skill;
- review whether a recurring process should become a reusable playbook;
- turn repeated workflow friction into a safer future default.

Do not use Reflect for ordinary implementation work, one-off debugging, broad
architecture review, or speculative agent creation without workflow evidence.

## Session Mode [branch: --sessions]

When the user includes `--sessions` in their reflect command, shift to session
archaeology across all repos to find repeated patterns and friction.

### Session Discovery

1. **Load recent sessions:**
   ```bash
   bun -e "import Database from 'bun:sqlite'; const db = new Database(process.env.HOME + '/.local/share/opencode/opencode.db'); console.log(db.query('SELECT id, directory, title, agent, model, time_created, cost, tokens_input, tokens_output FROM session ORDER BY time_created DESC LIMIT 50').all())"
   ```
   Adjust `LIMIT 50` to `--last N` if specified.
2. **Load session messages** per session ID:
   ```bash
   bun -e "import Database from 'bun:sqlite'; const db = new Database(process.env.HOME + '/.local/share/opencode/opencode.db'); console.log(db.query('SELECT data FROM message WHERE session_id = ?').all('<session_id>'))"
   ```

### Per-Session Analysis

For each session, produce a structured summary:

```json
{
  "session": "ses_14de9c68effegtZtlATm42wnz7",
  "project": "/home/user/Projects/oh-my-opencode-slim",
  "timestamp": "2026-06-10T15:08:45.427Z",
  "goal": "Fix CI failure",
  "success": true,
  "frictions": [
    "Repeated grep to find test file",
    "Three failed test runs before passing"
  ],
  "recommendations": [
    "Create /test-ci command"
  ],
  "duration_minutes": 18,
  "models_used": ["opencode/mimo-v2.5-free"],
  "agents_used": ["orchestrator", "fixer", "explorer"],
  "tools_used": ["Read", "Edit", "Bash"],
  "confidence": 0.85
}
```

**Confidence:** 0.9-1.0 clear patterns; 0.7-0.9 inferred from tool usage; 0.5-0.7 uncertain; <0.5 skip.

### Storage and Caching

Store summaries in `~/.config/opencode/oh-my-opencode-slim/reflections/sessions/`.
Reuse `<session-id>.json` if present; else analyze and save, then aggregate.

### Aggregation

1. Group by theme, count frequency ("42/50 sessions had repeated grep"), rank by impact.
2. Filter noise (skip one-offs); cross-reference by model, agent, or repo.
3. Scope: **global** (>50% of repos) | **cross-repo** (listed repos) | **project-specific** (one repo).

### Output Format

Return a compact report with scope and confidence:

```text
Session Reflection Report
Analyzing 50 most recent sessions across 8 repos.

Repos analyzed:
- <repo> (<N> sessions)
- ... (M more)

Findings
- <pattern>: N/50 sessions across M repos.
  - Scope: global | cross-repo (<repos>) | project-specific (<repo>)
  - Confidence: 0.95
  - Impact: High | Medium | Low

Recommended changes
- <asset>: <purpose>
  - Scope: global | cross-repo (<repos>) | project-specific (<repo>)
  - Confidence: 0.97
  - Estimated time saved: High | Medium | Low

Skipped
- <candidate>: why not worth packaging now.
  - Scope: <reason>
  - Confidence: <score>

Needs more evidence
- <candidate>: what would make it actionable.
  - Current scope: <what we've seen>
  - Required scope: <what would confirm>
```

### Error Handling

- No log or empty log → report "no sessions to analyze" and stop.
- Unloadable session or no messages → skip with warning, continue.
- Log failures and continue with remaining sessions.
- Report skip count at end: "3 sessions skipped due to load errors".

## Core Contract

Reflect must be conservative and evidence-driven.

Required behavior:

- inspect existing assets before suggesting new ones;
- prefer recent, repeated, user-visible friction over isolated incidents;
- recommend the smallest useful form;
- treat "create nothing" as a successful result when evidence is weak;
- ask before changing prompts, skills, commands, agents, MCP access, or config;
- avoid duplicating existing assets;
- explain restart requirements for config, prompt, agent, skill, MCP, or
  plugin changes.

## Evidence Sources

Use available evidence in this order:

1. Current conversation and explicit user instructions.
2. Project-local guidance and memories (`AGENTS.md`, `.opencode/`, `.slim/`, notes, checkpoints, codemaps).
3. Existing skills, commands, agents, prompt overrides, MCP permissions, and oh-my-opencode-slim configuration.
4. Recent logs or session artifacts if available and safe to inspect.
5. External docs only when a proposed workflow depends on third-party behavior needing confirmation.

Respect privacy and safety boundaries. Do not inspect unrelated personal files,
credentials, or private messages unless the user explicitly asks and the workflow requires it.

## Workflow

Reflect can be triggered directly:

```text
/reflect
/reflect release workflow and checks
/reflect --sessions
/reflect --sessions --last 100
```

With no arguments, review recent work broadly. With arguments, focus on that area.

### 1. Inventory Existing Assets

Inventory what already exists:

- bundled and user-installed skills;
- custom agents and their `orchestratorPrompt` guidance;
- custom commands;
- prompt overrides and append files;
- active preset, model routing, skills, and MCP permissions;
- project playbooks, docs, codemaps, and local workflow notes.

Extend covering assets; do not near-duplicate.

### 2. Find Repeated Workflow Patterns

Look for repeated signals such as:

- the same command sequence, review/setup/release/debug process, or research
  steps keep recurring;
- the same routing decision or project-specific rule is repeatedly re-explained;
- repeated failures happen because an agent lacks a stable instruction, tool, or
  permission boundary.

Strong candidates have at least two occurrences, stable inputs, a clear
output, and a clear stopping condition.

### 3. Score Candidates

For each candidate, decide:

- **Frequency:** How often has it happened?
- **Cost:** Time, context, money, or attention wasted?
- **Risk:** Bugs, regressions, bad decisions, or unsafe changes?
- **Stability:** Predictable inputs and output?
- **Coverage:** An existing asset already handles it?

Only recommend creating or changing assets when confidence is high.

### 4. Choose the Smallest Useful Form

Pick the least powerful form:

- **Prompt/config rule:** a small behavior change to an existing agent.
- **Skill:** reusable workflow guidance for a task shape.
- **Command:** a repeatable manual trigger with stable inputs.
- **Custom agent:** a distinct specialist lane with clear delegation rules.
- **MCP/tool permission change:** a safe access adjustment for an existing agent.
- **Project playbook/doc:** human-readable guidance when automation is too heavy.
- **Skip:** weak, one-off, ambiguous, sensitive, or already-covered work.

Prefer weaker forms: rule over agent, skill over agent, playbook over skill; skip when benefit is unclear.

### 5. Propose Before Changing

Propose before writing files or changing config (unless the user requested a specific edit):

```text
Found 2 strong repeated workflows and 1 weak candidate.

Recommended:
- Add a small orchestrator prompt rule for <workflow> because <evidence>.
- Extend existing <skill> instead of creating a new one because <overlap>.

Skip:
- <candidate> because it only appeared once.

Proceed with the proposed edits?
```

When applying changes, preserve existing user settings and prefer narrow,
append-only edits.

## Output Format

Return a compact report:

```text
Findings
- <workflow>: evidence, frequency/confidence, recommended form.

Recommended changes
- <asset/config/doc>: one-line purpose and why this is the smallest useful form.

Skipped
- <candidate>: why not worth packaging now.

Needs more evidence
- <candidate>: what would make it actionable.
```

If nothing qualifies, say:

```text
No strong repeated workflow found. I would not add or change any reusable assets
yet.
```

## Guardrails

- Do not manufacture assets to justify the workflow; do not create overlapping skills or agents.
- Do not silently change global config, prompts, or permissions.
- Do not add broad instructions that make agents more eager, expensive, or
  invasive without a clear benefit.
- Do not overfit to a single session unless the user explicitly asks for that workflow.
- Do not use private or sensitive material as examples in generated assets.
- On config, prompt, agent, skill, MCP, or plugin changes, state: "Applies on
  the next OpenCode run; restart OpenCode if you need it immediately."
