# Bundling Community Presets into the Shipped Preset Catalog

The project does not bundle community-submitted preset configs into the
shipped, project-maintained preset catalog. Community presets belong in the
Community Presets gallery (via the submission form) and in GitHub Discussions,
where their own owners keep them updated.

## Why this is out of scope

A bundled preset is a snapshot of model choices that goes stale fast:
providers rename or deprecate models, variants disappear, and prices shift.
Each bundled preset is an implicit promise to keep a third-party lineup valid
across that churn, and a preset that resolves to dead models is worse than no
preset. alvinunreal on PR #618: *"we can't maintain many presets, for now
keeping 2 ; opencode-go already hard to keep updated"*, and on discussion
#558: *"it hard for me to makntain it since i dont use it - if someone owns
who uses this oreset and updates"* — a bundled preset needs a maintainer who
uses it, which the project cannot be for third-party lineups.

## What is supported instead

- **Community Presets gallery**: submissions come through the
  `preset_submission.yml` form (label `community-preset`) and are reviewed for
  clarity and validity before being listed (`docs/maintainers.md`). Listing is
  not bundling — the preset stays community-owned and community-maintained.
- **GitHub Discussions**: sharing and tuning community configs (e.g. the
  OpenCode Go preset thread, #558).

Do not close a `community-preset` submission citing this record: this record
covers only the bundled catalog.

## Prior requests

- #1014 — "[Preset] opencode-slim hybrid fallback" (routed to Discussions)
- #890 — "[Preset] <gpt&go>" (routed to Discussions)
- #1017 — "[Preset] best-price-opencode-go" (routed to Discussions)