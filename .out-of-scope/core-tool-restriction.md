# Restricting or Wrapping OpenCode Core Tools

This project does not wrap, hide, or restrict OpenCode core tools, such as preventing agents from disabling autocontinue.

## Why this is out of scope

Feature request #483 (and Discussion #757) proposed restricting the agent's ability to disable `auto_continue`, or removing `auto_continue` from the bundled toolset so it could only be invoked as a user command.

The maintainers and collaborators decided against this:

- `auto_continue` is a native OpenCode core tool, not a plugin-defined tool. The plugin does not maintain wrappers or filters over upstream tools.
- Stripping or restricting an agent's control over continuation tools risks trapping sessions in runaway, uncontrollable execution loops—a known point of failure in earlier orchestration experiments.
- Plugin policy is to let OpenCode core tools retain their native behavior and permissions, allowing the user to configure tool permissions via OpenCode's native permission configuration (`opencode.json`) rather than hardcoding opinions in the plugin.

## Prior requests

- #483 — "[Feat]: the agent should not be able to disable autocontinue" (closed; moved to discussion)
- Discussion #757 — "[Feat]: the agent should not be able to disable autocontinue" (declined)
