# Release acceptance record

Complete this record for each production release. Automated checks do not
replace physical printer, Telegram account, or production backup evidence.

## Latest local candidate run

- Branch: `fix/release-readiness-batch`
- Run at: 2026-09-21 11:57 Asia/Tashkent
- Result: automated code gates passed locally; production release remains
  blocked by the mandatory external evidence listed below.
- Evidence: 12/12 typecheck/lint tasks, 6/6 production builds, 31/31
  operations validators, 231/231 backend tests, 38/38 Desktop tests, and a
  disposable 39-migration web/Telegram order-to-cash-to-stock-to-print E2E.
- Note: Turbo's Windows interactive cache spinner required the already-passed
  stages to be run separately. The stage exit results above are authoritative.

## Release identity

- Commit:
- Operator:
- Started at (Asia/Tashkent):
- Finished at (Asia/Tashkent):

## Mandatory evidence

| Gate | Actor/time | Result | Evidence |
| --- | --- | --- | --- |
| Restored production backup migration rehearsal | | | |
| `pnpm release:acceptance` | | | |
| CI `verify` on merged `main` commit | | | |
| Read-only pre-deploy production smoke | | | |
| Desktop enrollment and remembered login | | | |
| Offline order replay and conflict recovery | | | |
| 58/80 mm sale, cancellation and reprint | | | |
| Telegram customer and staff-group lifecycle | | | |
| Post-deploy `pnpm release:acceptance -- --production-smoke` | | | |

## Safety declaration

- No fake production order was created for automated smoke.
- No Click, Payme or card method was enabled without a signed provider.
- Database backup and rollback owner are recorded before migration.
- Failed or unavailable evidence is marked failed, never inferred as passed.
