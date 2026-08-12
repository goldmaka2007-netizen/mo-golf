# Current Project State

**Last reviewed:** 2026-08-09
**Repository:** `goldmaka2007-netizen/mo-golf`  
**Branch reviewed:** `main`  
**Deployed code head:** `347e0fcc74130c508b0a1a05080635ff97b39dde`
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

### WAC audit Excel export — implemented locally, pending deployment 2026-08-12

- Settings > Import/Export now includes a local, read-only `makka_wac_audit_YYYY-MM-DD.xlsx` export with Arabic sheets for WAC summary, inventory movements, merchant signed carrying-value movements, and combined diagnostics.
- The report consumes the canonical runtime Inventory WAC timeline and the existing signed merchant-metal carrying-value timeline; audit snapshots are rebuilt through those same paths and introduce no posting or valuation formula.
- Focused export/inventory/merchant tests, TypeScript, Balance Contract Guard, and one production build passed. Firestore data, Rules, Functions, Storage, and Auth remain out of scope.

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

### Clone-only Chart of Accounts — implemented locally, deployment blocked 2026-08-10

- Replaced the Shadow-mode Discovery/Migration/Parity account UI and the separate free-form account tree with one mobile-first `دليل الحسابات` screen.
- New entities are created only through `إنشاء حساب مشابه`; the form accepts a new name only and inherits an explicit whitelist of classification and operational rule fields.
- The authoritative stored entity remains one `accounts` document. Inventory Sales/COGS companions remain read-only derived accounts; inventory clones point to the verified root `cloneSourceAccountId` used by the runtime Cost/WAC resolver.
- Creation uses one Firestore transaction across the deterministic account-name reservation, cloned `transactionRules`, and immutable audit record. No balance, WAC, carrying state, history, alias, or source identity is copied.
- Conservative global-per-ledger duplicate detection covers active and inactive/archived `accounts` plus canonical names; concurrent equivalent requests share one deterministic target ID, so exactly one succeeds.
- Focused verification passed: 15 files / 108 tests, plus the second-generation Cost taxonomy regression; TypeScript, Balance Contract Guard, and production build passed.
- Read-only authenticated local browser smoke passed for the chart, customer clone dialog, product clone dialog, legacy guard, cash/system guard, and console errors. No clone was submitted and no Firestore write occurred.
- Hosting deployment is intentionally blocked: the existing full suite is red in six unrelated accounting/Golden assertions plus one worker timeout. The focused change set remains green; no baseline was regenerated.

### Signed merchant gold/silver positions — deployed and browser-verified 2026-08-09

- Replaced the one-sided Merchant Gold Liability projection with one central signed merchant-metal carrying-value timeline: positive positions are payables, negative positions are receivables, gold uses E21, and silver uses physical grams with independent WAC state.
- Physical zero-crossings close the old side at carried WAC, recognize the legitimate metal-specific settlement difference, and establish only the excess at the immutable operation basis. Merchant transfers preserve source carrying value without inventory movement or P&L.
- Official Balance Sheet and Trial Balance classification now follows each merchant's economic metal sign while cash/workmanship remains separate. `الاء ياسر` is routed through the general gold-merchant engine without changing Firestore account identity.
- Narrow missing-price repair wrote only `invoiceOfficialPricePerGramEgp` on 12 eligible non-opening `entries`; 0 existing valid prices changed and 0 eligible rows remained missing. Opening entries continued to use Settings opening cost.
- Production anchors: خالد حميدو ended at zero metal/cash/carrying value; الصافي ended at -1.36g E21 as a Gold Receivable of 8,228 EGP; TX1768 carried 89,083.02 EGP with no inventory or P&L; TX39 valued 25.2g E21 at the Settings price of 5,840 EGP/g for 147,168 EGP.
- Verification passed: 5 focused files / 29 tests, TypeScript, Balance Contract Guard, production data audit, and one Vite production build. The deployed asset is `assets/index-CK9rVgMm.js`.
- Code commit `347e0fcc74130c508b0a1a05080635ff97b39dde` was pushed and deployed once to Firebase Hosting only.
- Authenticated production browser smoke passed: Firebase initialized, React rendered, Home and merchant operations loaded, `الاء ياسر` appeared in the generic gold-merchant selector, the Balance Sheet loaded with zero balance difference, and no console runtime errors appeared. One pre-existing legacy account-nature fallback warning remained.
- Firestore Rules, Indexes, Functions, Storage, and Authentication were unchanged. Apart from the authorized 12-field price backfill, production Firestore history was unchanged.

### Emergency production startup recovery — verified 2026-08-09

- The production black screen was caused by a Hosting build created without the required `VITE_FIREBASE_*` configuration; the first browser exception was `Missing required Vite environment variable: VITE_FIREBASE_API_KEY`.
- Added a Vite build-time guard so a bundle missing required Firebase Web App configuration cannot be produced or deployed again.
- TypeScript, the Balance Contract Guard, one production build, one local browser smoke, and one cache-busted production browser smoke passed.
- Code commit `a1e56b67e01cdcba263cccac8fc7feb085fc1012` was deployed once to Firebase Hosting only.
- Deployed asset: `assets/index-CsjEC3Dn.js`; Firestore Data, Rules, Indexes, Functions, Storage, and Authentication were unchanged.

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
