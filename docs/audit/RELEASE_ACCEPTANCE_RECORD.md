# Release acceptance record

Complete this record for each production release. Automated checks do not
replace physical printer, Telegram account, or production backup evidence.

## Latest local candidate run

- Branch: `fix/release-readiness-batch`
- Run at: 2026-09-23 Asia/Tashkent
- Result: local automated gates passed by stage; production release remains
  gated by the mandatory external evidence listed below.
- Evidence: 12/12 typecheck/lint tasks, 6/6 production builds, 32/32
  operations validators, 240/240 backend tests, 40/40 Desktop tests, and a
  disposable 40-migration web/Telegram order-to-cash-to-stock-to-print E2E.
- Note: the Windows Turbo process did not return after build output in the
  combined runner, so the remaining stages were run separately. Their exit
  results are authoritative; this is not a production certification.

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
