# Makka 1 Production — 2026-09-10 Backdated Day Recovery

Status: CLOSED / OWNER MANUAL ACCEPTANCE PASS / PRODUCTION DATA RECOVERY ONLY.

## Incident
A day of entries intended for 2026-09-09 was initially saved under 2026-09-10. Editing entries one-by-one to 2026-09-09 caused the fail-closed inventory cost engine to stop when a sale reached the timeline before its corresponding stock-in entry.

## Recovery
- Production Firebase project: `makka-central-accounting`
- Firestore database: `(default)`
- Collection changed: `entries`
- A verified raw backup of the target set was created before deletion.
- Exactly 14 owner-approved entries were batch-deleted: 2 dated 2026-09-09 and 12 dated 2026-09-10.
- Post-delete verification returned 0 entries for both target dates.
- `audit_logs`, Accounts, Opening Cost, Firebase Rules/Indexes/Functions/Auth/Storage, application code, and other dates were not changed by the recovery.

## Final owner acceptance
The owner manually cleared/re-entered the affected business data and confirmed the application is now working normally.

## Boundary
No WAC/COGS/Balance Engine rule or application code was changed. This document records the production data recovery and owner acceptance only.
