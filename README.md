# Makka Application

Production accounting and inventory application for a gold, silver, and accessories business in Egypt.

- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Repository: `goldmaka2007-netizen/mo-golf`
- Current technical state: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)
- Engineering rules: [`CONSTITUTION.md`](CONSTITUTION.md)
- Durable decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Accounting architecture: [`docs/ACCOUNTING_ARCHITECTURE.md`](docs/ACCOUNTING_ARCHITECTURE.md)

## Local development

Prerequisite: Node.js.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run check:balance-contract
npm test
npm run build
```

## Production deployment

The repository is configured for Firebase project `makka-central-accounting` and the normal deployment command is:

```bash
npm run deploy
```

Deployment is Firebase Hosting only unless a wider Firebase change is explicitly approved.

## Documentation rule

Do not treat historical release notes as the current state. Start with `docs/CURRENT_STATE.md`, then follow the relevant decision/ADR/release links. Significant releases must keep `docs/CURRENT_STATE.md` synchronized with the deployed production baseline.
