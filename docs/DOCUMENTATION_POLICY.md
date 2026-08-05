# Documentation Policy

## Purpose

Keep Codex and human contributors informed without forcing them to reread the full project history on every task.

## Document classes

### Stable

- `CONSTITUTION.md`
- Active ADR decisions

Change rarely and only after explicit approval.

### Maintained

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/ACCOUNTING_ARCHITECTURE.md`

Update when durable rules, responsibilities, or reading routes change.

### Current

- `docs/CURRENT_STATE.md`

Update after significant fixes, releases, newly confirmed risks, or changed validation commands.

### Historical evidence

- Old release reports.
- Session summaries.
- Chat exports.
- Notion and Drive copies.
- Superseded ADRs.

Historical evidence supports investigation but does not override active decisions automatically.

## Required update behavior

### Every significant code change

Update `CURRENT_STATE.md` with only information useful to the next contributor:

- What became stable.
- What remains risky.
- New/changed central paths.
- Validation actually performed.
- Deployment result, when applicable.

Do not turn Current State into a chronological dump.

### New durable decision

Add an ADR and add its final rule to `DECISIONS.md` when active.

### Superseded decision

Do not delete the old ADR. Mark it `Superseded`, link the replacement ADR, and update Decisions and Architecture.

### Technical rename or move

Update affected paths in Architecture, Current State, and AGENTS in the same task when safe.

## Freshness rules

- Current State must contain a review date and reviewed commit SHA.
- File paths are low-trust until checked against the current branch.
- Test counts and asset names are historical facts tied to a commit, not permanent promises.
- Avoid embedding volatile data in the Constitution.

## Brevity rules

- Constitution: principles and invariants only.
- AGENTS: entry point and critical reminders only.
- Current State: target 50–150 lines.
- Decisions: one compact section per active decision.
- ADR: normally one page.
- Architecture: central flow and boundaries, not line-by-line implementation notes.

## Source reconciliation

When promoting information from Notion, Google Drive, chats, or an old report:

1. Identify the source date and commit, when available.
2. Check the current branch and tests.
3. Classify conflicts.
4. Preserve the source's intended business rule without copying stale technical names.
5. Record uncertainty instead of silently reconciling incompatible claims.

## Review checklist

- Does the document conflict with the Constitution?
- Is the statement a durable rule, current state, or historical fact?
- Are technical paths verified?
- Could the wording accidentally authorize a production data change?
- Does it tell the next contributor what to read, not everything that ever happened?
