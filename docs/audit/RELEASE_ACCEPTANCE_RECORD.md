# Release acceptance record

Complete this record for each production release. Automated checks do not
replace physical printer, Telegram account, or production backup evidence.

## Latest local candidate run

- Branch: `fix/release-readiness-batch`
- Run at: 2026-09-23 Asia/Tashkent
- Result: local automated gates passed by stage; production release remains
  gated by the mandatory external evidence listed below.
- Evidence: 12/12 typecheck/lint tasks, 6/6 production builds, 32/32
  operations validators, 244/244 backend tests, 43/43 Desktop tests, and a
  disposable 40-migration web/Telegram order-to-cash-to-stock-to-print E2E.
- `pnpm release:acceptance` was rerun with `TURBO_UI=stream` and
  `TURBO_DAEMON=false`; the combined runner returned successfully after all
  stages. This is still not a production certification because no deploy was
  performed.
- Read-only production smoke: `pnpm release:smoke` passed `23/23` against the
  default public production domains on 2026-09-23; the checks were GET-only and
  did not create or mutate production data.
- Desktop release candidate `0.1.40` was built locally as an NSIS x64
  installer; `release/latest.yml` points to the matching `0.1.40` artifact.
  The artifact has not been published or deployed yet.
- Public GitHub `latest.yml` was checked read-only and still reports `0.1.39`;
  therefore the missing update is currently a publication gap, not an updater
  version-detection gap.
- Godex G500 acceptance is not passed: Windows reports the printer as normal,
  but 21 queued jobs remain with `PagesPrinted=0` (oldest job 01:10 Asia/Tashkent)
  on `USB001`. A present USB device is also reported as `Unknown USB device`
  with `USB\VID_0000&PID_0002` and descriptor-request failure. No paper output
  can be inferred from this spooler state; the hardware/USB layer must be fixed
  before the receipt renderer can receive physical acceptance.
- Read-only production media audit checked all 74 customer-catalog products;
  every product had an image URL and all 74 media `HEAD` requests returned
  HTTP 200.
- Read-only Telegram acceptance is available as `pnpm telegram:smoke`; it
  requires `TELEGRAM_BOT_TOKEN` (and optionally the staff token), never changes
  a webhook, and never prints credentials. It could not run in this checkout
  because production tokens are not present.

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
