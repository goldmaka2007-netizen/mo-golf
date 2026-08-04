# Production Deployment Report

Date: 2026-08-04 (Africa/Cairo)

- Firebase project: `makka-central-accounting`
- Production URL: https://makka-central-accounting.web.app
- Starting commit: `56dbb2d1d4f310217c2e18098febb4f9ce86c961`
- Deployed code commit: `966d481bec2b1a601fff29c2396d9a79cf1f49da`
- Commit message: `fix(invoices): enforce dimensions and standardize report numbers`
- Push: succeeded; `origin/main` confirmed at the deployed code commit before deployment.
- Deployment: Firebase Hosting only, succeeded.
- Root HTTP status: 200.
- Main JavaScript HTTP status: 200.
- Local/production asset match: `assets/index-BEk4es11.js`.

The configured `FIREBASE_TOKEN` environment variable was unavailable. Deployment used the already authenticated local Firebase CLI session for `goldmaka2007@gmail.com`, after confirming the active project. No other Firebase service was targeted.

## Safety
Firestore Data, Rules, Indexes, Functions, Storage, Authentication, and production environment data were unchanged. No migration and no production Firestore writes were used for testing.

## Rollback reference
If rollback is required, the previous code commit is `56dbb2d1d4f310217c2e18098febb4f9ce86c961`. The deployed release commit is `966d481bec2b1a601fff29c2396d9a79cf1f49da`. Rollback must follow the normal reviewed Git/Firebase Hosting release process; do not rewrite Firestore data.
