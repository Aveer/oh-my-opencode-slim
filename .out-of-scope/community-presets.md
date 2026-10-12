# Community Preset Curation

The project does not merge community-submitted preset configs into the
shipped preset catalog or the website listing. Preset sharing lives in
GitHub Discussions instead.

## Why this is out of scope

A community preset is a snapshot of model choices that goes stale fast:
providers rename or deprecate models, variants disappear, and prices shift.
Each merged preset is an implicit promise to keep a third-party lineup valid
across that churn, and a preset that resolves to dead models is worse than
no preset. The project has no review capacity for that upkeep, so the
sustainable surface is Discussions (e.g. the OpenCode Go preset thread,
#558), where the community reviews and updates configs without the project
owning their maintenance. alvinunreal on PR #618: *"we can't maintain many
presets, for now keeping 2 ; opencode-go already hard to keep updated"*, and
on discussion #558: *"it hard for me to makntain it since i dont use it - if
someone owns who uses this oreset and updates"* — a preset needs an owner who
uses it, which community threads provide and the project cannot.

## Handoff convention

When closing a community-preset submission:

1. Cross-post the preset config to the Discussion matching its provider or
   theme (e.g. #558 for OpenCode Go lineups) so the work isn't lost.
2. Thank the reporter and tag everyone who participated in the issue, so the
   conversation follows the post instead of dying with the closed issue.
3. Close in favor of that discussion link (see #890 and #1017 for the shape).

## Prior requests

- #1014 — "[Preset] opencode-slim hybrid fallback"
- #890 — "[Preset] <gpt&go>"
- #1017 — "[Preset] best-price-opencode-go"
