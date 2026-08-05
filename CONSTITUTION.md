# Makka Application Project Constitution

**Status:** Active  
**Applies to:** Human contributors, Codex, and other coding agents  
**Repository:** `goldmaka2007-netizen/mo-golf`  
**Production:** `https://makka-central-accounting.web.app`  
**Firebase project:** `makka-central-accounting`

This document defines how engineering decisions are made in Makka Application. It is intentionally stable. Project state, file paths, and recent releases belong in `docs/CURRENT_STATE.md`; detailed decisions belong in `docs/DECISIONS.md` and `docs/adr/`.

## Article I — Mission

Makka is a production accounting and inventory system for a gold, silver, and accessories business in Egypt. Its first duty is preserving accounting correctness, inventory-cost integrity, historical compatibility, and user trust.

A change is successful only when it solves the real problem without introducing hidden accounting, data, reporting, or operational regressions.

## Article II — Authority and conflict resolution

Use this order when sources conflict:

1. The user's explicit instruction for the current task, unless it would silently overturn a protected accounting or data-integrity decision.
2. This Constitution.
3. Final decisions in `docs/DECISIONS.md`.
4. Active ADRs in `docs/adr/`.
5. `docs/CURRENT_STATE.md`.
6. Executable contracts and focused regression tests.
7. Current implementation code.
8. Historical notes, deployment reports, chat summaries, Notion pages, and Drive copies.

Two different kinds of truth must remain separate:

- **Business and accounting intent:** the Constitution, final decisions, and active ADRs are authoritative.
- **Technical location and implementation shape:** verify names, paths, functions, and dependencies against the current branch before acting.

If a protected decision conflicts with code, classify the conflict as either a code regression, outdated documentation, an intentional approved change, or uncertain. Do not silently choose one.

## Article III — Production-first engineering

Treat the application as production software by default.

- Find the root cause before editing.
- Prefer the smallest central correction that fixes every affected path.
- Preserve backward compatibility and historical data.
- Do not perform broad refactors, mass renames, directory moves, or dependency changes merely because they appear cleaner.
- A broad refactor requires evidence that a local correction is unsafe or insufficient, a short impact plan, and explicit user approval.
- Do not modify unrelated files.

## Article IV — Historical respect

Assume unusual logic may exist because it protects a real historical case.

Before deleting, bypassing, merging, or simplifying compatibility logic:

1. Search active ADRs, final decisions, tests, and nearby comments.
2. Identify the historical behavior being protected.
3. Prove the replacement preserves that behavior.
4. Add or retain a regression test.

The absence of an obvious explanation is not proof that code is unnecessary.

## Article V — Smart reading budget

Every task begins with the smallest useful context.

1. Read `AGENTS.md` and the files it marks as required.
2. Read `docs/CURRENT_STATE.md`.
3. Read only the decision, ADR, architecture section, and source files relevant to the task.
4. Start with approximately 3–10 directly related source/test files.
5. Expand only when the current evidence is insufficient; state what is missing and why the expansion is necessary.

Do not scan the entire repository by default. Repository-wide review is appropriate only for an explicitly broad audit or when a cross-cutting failure has been demonstrated.

## Article VI — Root-cause protocol

Before changing code, provide a diagnostic of no more than eight concise lines:

1. Observed behavior.
2. Expected behavior.
3. Likely root cause.
4. Confidence level.
5. Files to inspect.
6. Minimal central fix.
7. Main risks.
8. Verification plan.

The diagnosis is a working hypothesis, not permission to invent facts. Update it when evidence changes.

## Article VII — Confidence policy

Classify material information as:

- **Known:** proven by current code, tests, final decisions, or active ADRs.
- **High-confidence inference:** strongly supported by evidence and safe to use only when it does not alter accounting behavior, stored data, protected architecture, or public contracts.
- **Unknown / blocking:** cannot be inferred safely and could affect accounting, WAC, posting, historical data, Firestore, architecture, contracts, or user-visible meaning.

Inference is allowed. Guessing is forbidden. Unknown blocking decisions require explicit user resolution.

## Article VIII — Accounting invariants

These rules are protected unless the user explicitly approves a new accounting decision and the documentation is updated accordingly.

### Central source

Opening entries and invoices feed one centralized accounting path. Ledger, Trial Balance, Income Statement, Statement of Financial Position, and supporting reports must consume central projections rather than recalculate accounting independently in UI components.

### Independent dimensions

Never add unlike dimensions together:

- EGP cash/accounting amount.
- Gold quantity expressed officially as equivalent 21 weight.
- Silver weight.
- Accessories quantity.
- Inventory book value in EGP.

Official financial statements are in EGP. Weight and quantity are supporting information.

### Treasury

Treasury is EGP cash-only. It does not carry gold, silver, accessories quantity, or inventory book value.

### Inventory and WAC

- WAC is the approved basis for inventory valuation and COGS.
- A sale creates revenue, inventory reduction, and COGS automatically.
- No double posting and no double COGS.
- Current market price must not be substituted for inventory cost.
- Runtime inventory IDs must pass through the centralized runtime cost-account resolution path before the strict cost engine.
- Invoice validation, WAC, Book Value, COGS, Ledger, Trial Balance, and financial statements must use compatible cost-timeline inputs.

### Financial balance

Official EGP statements must satisfy:

`Assets = Liabilities + Equity`

Financial projections and each quantity dimension must follow their existing balance contracts.

## Article IX — Data integrity and Firebase safety

Unless the current task explicitly authorizes otherwise:

- Firestore production data remains unchanged.
- Firestore Rules, Indexes, Functions, Storage, and Authentication remain unchanged.
- No migration or rewriting of historical transactions.
- Do not use production Firestore as a test environment.
- Read-only production inspection is allowed only when explicitly authorized and necessary for diagnosis.
- Deployment scope is Firebase Hosting only.

Never hide a data incompatibility by silently rewriting production records.

## Article X — Testing and change safety

Choose the smallest sufficient verification during development, then run the appropriate final gates once the implementation is stable.

For accounting, WAC, posting, balance, or report changes, consider in this order:

1. Focused regression tests for the exact failure.
2. Related posting/WAC/report tests.
3. `npm run test:golden:prerequisites` when cost history or WAC is affected.
4. `npm run test:golden` when its protected contract is affected.
5. `npm run check:balance-contract`.
6. `npm run typecheck`.
7. `npm run build`.
8. Full `npm test` when the scope warrants repository-wide validation.

Do not regenerate or modify the Golden Baseline merely to make a failure disappear. A baseline change requires an approved business/accounting change and evidence that the expected output changed legitimately.

## Article XI — Documentation synchronization

When code and documentation differ:

1. Classify the mismatch: outdated documentation, code regression, intentional approved change, or uncertain.
2. Explain the evidence briefly.
3. Technical metadata may be updated in the same task: file names, paths, commit IDs, test counts, or renamed symbols.
4. Accounting rules, data policy, architectural authority, and protected behavior require explicit approval before changing either documentation or code.

Every significant change must update `docs/CURRENT_STATE.md`. A new durable architectural decision must add or supersede an ADR.

## Article XII — Definition of Done

A task is complete only when the final report states and supports:

- Root cause proven or clearly justified.
- Minimal central correction implemented.
- No unjustified refactor.
- Appropriate tests/checks passed, with exact commands or scope.
- Protected contracts remain intact.
- Firestore and Firebase surfaces changed only as explicitly authorized.
- Files changed and why.
- Remaining risks or technical debt.
- Deployment result and post-deployment verification, when deployment was authorized.
- Final status: **Completed**, **Partially Completed**, or **Blocked**.

Do not claim completion while a known material issue remains unresolved.

## Article XIII — Deployment

Deployment is never implied by completing code.

- Deploy only with explicit user authorization.
- Use Firebase Hosting only unless the user explicitly approves a wider Firebase change.
- Build and required guards must pass first.
- Verify the production root and deployed main asset once after deployment.
- Record the deployed commit and verification result in `docs/CURRENT_STATE.md` or the relevant release note.
