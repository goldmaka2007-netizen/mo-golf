# Operational Home Redesign — Production Release

Date: 2026-08-28
Status: Owner accepted on live iPhone; GitHub source sync

## Accepted behavior

- Mobile-first dark/navy and gold Operational Home.
- Existing Story Builder opens from the prominent WhatsApp Status shortcut.
- Main shortcuts are exactly: مساعد الشراء، مساعد البيع، جرد الأصناف.
- Recent Entries and duplicate Home operation shortcuts are absent.
- Treasury and Gold summary are prominent. Gold continues to consume the existing Financial Position ownership projection; its details action opens Reports → Financial Position using `reportsTab = 'balance'`.
- MetalPriceEditor is compact on mobile, keeps Gold 21 and Silver side-by-side where the responsive layout allows, and keeps explicit Save and Clear X.
- Arabic/Persian digits and supported Arabic decimal separators normalize visibly while typing: `٦٥٠٠` → `6500`, `۶۵۰۰` → `6500`, `٦٥٠٠٫٥` → `6500.5`. Empty drafts remain temporary and are validated only on explicit Save.

## Evidence

- Owner live iPhone visual/manual acceptance: PASS, 2026-08-28.
- Focused Home/price/navigation tests: PASS (13/13).
- `npm run typecheck`: PASS.
- `npm run check:balance-contract`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

## Production and boundaries

- Firebase Hosting-only Production deployment already completed successfully.
- Accepted Production asset: `/assets/index-BxviThw1.js`.
- Deployment verification made no Production accounting write.
- This GitHub source-sync step performs no additional deploy.
- Posting Matrix, WAC/COGS, Balance Engine, Financial Position calculations, Entry contracts, Firestore data/rules/indexes/functions/storage/auth, Golden Baseline, pricingConfig, Gold Assistant rules, dependencies, and Vite/Firebase configuration were unchanged.
