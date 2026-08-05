# Makka Application — Agent Entry Point

You are working in a production accounting and inventory system for gold, silver, and accessories.

## Mandatory reading order

1. Read `CONSTITUTION.md`.
2. Read `docs/CURRENT_STATE.md`.
3. Read only the relevant sections of:
   - `docs/DECISIONS.md`
   - `docs/ACCOUNTING_ARCHITECTURE.md`
   - active records under `docs/adr/`
4. Inspect the smallest relevant set of source and test files.

`CONSTITUTION.md` defines behavior and decision-making. Do not duplicate or weaken it here.

## Task start

Before editing, provide the eight-line maximum diagnostic required by the Constitution. Verify technical paths against the current branch; documentation is authoritative for protected business decisions, not for stale file locations.

## Critical reminders

- Production first; root cause first; smallest central correction.
- No broad refactor without explicit approval.
- Treasury is EGP cash-only.
- WAC controls inventory Book Value and COGS.
- Official gold supporting quantity is equivalent 21 weight.
- Keep EGP, gold, silver, accessories quantity, and Book Value as independent dimensions.
- No Double Posting or Double COGS.
- Do not recalculate accounting inside report/UI components.
- Do not call the strict low-level inventory cost engine directly from UI or invoice validation; use the centralized runtime cost-timeline path verified in current code.
- Do not modify production Firestore data, Rules, Indexes, Functions, Storage, or Authentication unless explicitly authorized.
- Do not regenerate Golden Baseline merely to pass tests.
- Deploy only after explicit authorization, and default to Firebase Hosting only.

## Communication

Use concise, direct Arabic for user-facing reports, with English technical/accounting terms when useful. State uncertainty honestly. Never claim a check, deployment, or result that was not actually performed.
