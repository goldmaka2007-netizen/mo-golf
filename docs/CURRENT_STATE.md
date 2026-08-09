# Current Project State

**Last reviewed:** 2026-08-09
**Repository:** `goldmaka2007-netizen/mo-golf`  
**Branch reviewed:** `main`  
**Reviewed head:** `89c5b5c70f9bb585506e83847e7961be19717e87`
**Production:** `https://makka-central-accounting.web.app`  
**Firebase project:** `makka-central-accounting`

This file is intentionally current and may change frequently. Verify the head SHA before relying on it in a later task.

## Current stable capabilities

- Centralized accounting posting/projection path.
- Unified General Ledger and Trial Balance.
- EGP Income Statement and Statement of Financial Position.
- Independent EGP, gold-equivalent-21, silver, accessories quantity, and Book Value dimensions.
- WAC inventory valuation and automatic COGS generation.
- Runtime inventory account resolution shared by invoice validation and cost/report consumers.
- Historical compatibility without Firestore migration.
- Arabic report labels, RTL/mobile improvements, drilldowns, and standardized number formatting.
- Dashboard gold/silver price editor restored.
- Dashboard return path uses an in-memory result cache keyed by existing inputs.

## Verified central implementation landmarks

These paths were present on the reviewed head; verify them again before editing:

- `src/lib/costRecalculation.ts`
  - Exposes `rebuildRuntimeInventoryCostTimeline` as the canonical runtime WAC path.
- `src/lib/runtimeCostAccountResolver.ts`
  - Resolves verified runtime inventory accounts to stable cost identities.
- `src/lib/inventoryCostEngine.ts`
  - Strict low-level cost engine; do not bypass runtime resolution from UI/invoice flows.
- `src/lib/postingMatrix.ts`
  - Canonical posting construction.
- `src/lib/legacyLedger.ts`
  - Builds central projected ledger legs; the historical file name does not mean the active projection is disposable.
- `src/lib/unifiedTrialBalance.ts`
  - Produces Trial Balance with source `central_posting_projection`.
- `src/lib/financialStatementsEgp.ts`
  - Builds official EGP financial statements.
- `src/lib/historicalInventoryOverlay.ts`
  - Approved historical compatibility directives.

## Latest reviewed changes

### Merchant gold liability WAC — verified locally 2026-08-09

- Added one in-memory Merchant Gold Liability WAC timeline, separate from Inventory WAC and merchant cash/workmanship.
- Merchant transfers carry source book value without inventory movement, market revaluation, or P&L.
- Physical settlement releases merchant liability and inventory at their separate WAC values; the difference posts to generated gold-liability settlement gain/loss accounts.
- Khaled Hamido and Mohamed El Sayed/Al-Safy invariants are covered by the focused regression fixture.
- Verification: 5 focused files / 48 tests, TypeScript, Balance Contract Guard, and production build passed.
- Code commit `89c5b5c70f9bb585506e83847e7961be19717e87` was deployed once to Firebase Hosting only.
- Deployed asset: `assets/index-aH8UYW97.js`.
- One post-deployment check returned HTTP 200 for both the production root and the deployed JS asset.

### `1e52cd5` — Dashboard metal prices and return loading

- Restored the current gold and silver price editor in Dashboard.
- Reused the existing user settings document and price fields.
- Added validation and immediate store refresh after save.
- Added an in-memory Dashboard result cache.
- Did not add Firestore listeners or queries for navigation.

### `f516bc7` — Runtime inventory account resolution

- Unified invoice validation, WAC, Book Value, COGS, and reporting through the runtime cost-timeline path.
- Covered 32 active production inventory IDs: 20 gold, 9 silver, and 3 accessories.
- Kept resolution fail-closed for unknown/conflicting IDs.
- Preserved production Firestore data and runtime IDs.

## Current validation commands

From `package.json` on the reviewed head:

- `npm test`
- `npm run test:golden:prerequisites`
- `npm run test:golden`
- `npm run check:balance-contract`
- `npm run typecheck`
- `npm run build`
- `npm run deploy` — builds and deploys Hosting; use only with explicit authorization.

Note: the current `lint` script is equivalent to `tsc --noEmit`, not an ESLint policy.

## Known risks and open quality gaps

- Root `README.md` is still a generic AI Studio starter and does not document the real production system.
- The previous root `AGENTS.md` described an obsolete triple-ledger model and could misdirect coding agents; this project-intelligence change replaces it.
- Historical compatibility layers are powerful but complex and require regression protection.
- Browser end-to-end coverage is not visible in current package scripts.
- Dashboard cache correctness depends on the existing immutable/reference update behavior of its inputs.
- Release/version discipline is weak: package version remains `0.0.0`, and production releases are mainly represented by commits and reports.
- An old branch named `agent/project-accounting-update` is diverged from `main` and contains broad unrelated changes, including Firebase/security files. Do not reuse or merge it without a dedicated audit.

## Next recommended priorities

1. Merge and adopt this Project Intelligence System.
2. Replace the generic root README with an accurate contributor/operator README.
3. Add focused browser E2E coverage for invoice creation, edit/delete, price save, Ledger drilldown, and official statements.
4. Establish release tags and a tracked issue backlog.
5. Review authorization/audit requirements for sensitive actions such as price changes, invoice mutation, and period close.
