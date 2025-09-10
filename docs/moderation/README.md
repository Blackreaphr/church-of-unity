# Moderation Config Overview

This repo includes moderation configuration and schemas that map directly to enforcement.

Key files:

- `config/moderation/taxonomy.json` — Controlled tags, sensitive selectors, UI copy, and validation messages.
- `config/moderation/thresholds.json` — Risk thresholds, tier overrides, media/link rules, and simple rate limits.
- `config/moderation/macros.json` — Moderator decision macros with audit requirements.
- `config/moderation/notifications.json` — User notification templates referenced by macros.
- `schemas/moderation/score-request.schema.json` — JSON Schema for the scoring request payload.
- `schemas/moderation/score-response.schema.json` — JSON Schema for the scoring response payload.

Integration notes:

- Treat moderation as a creation-time pipeline: invoke a scoring service with the request schema, then route using `thresholds.json` and label hits. P0 hits are always blocked and actioned immediately.
- For new accounts (T0), default to Limited or Quarantine when scores are uncertain. Use `tier_overrides` to determine routing.
- Use `macros.json` to power a moderator UI with consistent actions; write to an immutable audit log with fields listed in `audit_log_fields`.
- Use `notifications.json` templates for user-facing messaging; replace placeholders like `[category]`, `[rule]`, and `[date]`.

