# Makka Project Intelligence System

This directory is the maintained project memory used by human contributors and coding agents.

## Start here

- `../CONSTITUTION.md` — stable engineering and accounting constitution.
- `../AGENTS.md` — short agent entry point.
- `CURRENT_STATE.md` — current branch/release status, known risks, and next priorities.
- `DECISIONS.md` — concise list of final active decisions.
- `ACCOUNTING_ARCHITECTURE.md` — central accounting flow and ownership boundaries.
- `DOCUMENTATION_POLICY.md` — how these files stay accurate.
- `adr/` — why durable architectural decisions were made.

## Reading routes

### Accounting or report bug

Read the Constitution, Current State, Decisions, Accounting Architecture, and the relevant ADR. Then inspect only the central engine and focused tests related to the symptom.

### Inventory/WAC bug

Also read ADR-003 and ADR-005. Verify that every consumer uses the runtime cost-timeline entry point rather than the strict low-level engine directly.

### UI-only bug

Read the Constitution and Current State. Confirm that the UI consumes central outputs and does not recreate accounting logic.

### Documentation-only work

Read the Constitution and Documentation Policy. Do not run expensive application checks unless a technical file or executable contract changes.

## Historical material

Chat exports, old deployment reports, Notion pages, and Drive copies are evidence, not automatic authority. Promote durable facts into Decisions, Current State, Architecture, or an ADR after checking them against the current branch.
