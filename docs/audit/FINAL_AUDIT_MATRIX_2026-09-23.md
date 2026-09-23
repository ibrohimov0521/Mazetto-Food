# Mazetto Food final audit matrix

Observed: 2026-09-23, Asia/Tashkent. This matrix is for the current local
release candidate on `fix/release-readiness-batch`; it does not claim that the
candidate is deployed.

| Area | Current result | Evidence | Remaining gate |
| --- | --- | --- | --- |
| Admin permanent and bulk delete | Complete for 17 mutable surfaces | `validate-admin-deletion-matrix`: 17/17; `pnpm validate`: 33/33 | Historical audit, payment and shift rows remain intentionally immutable |
| Telegram customer/staff split | Code and automated flows complete | Backend 244/244, Telegram validators, staff/customer webhook paths; read-only `pnpm telegram:smoke` attempted and stopped safely because `TELEGRAM_BOT_TOKEN` is not configured | Real BotFather tokens, webhook info and customer/staff human smoke |
| Production media | Passed read-only audit | 74/74 customer products had image URLs; all 74 media HEAD checks returned HTTP 200 | Browser visual check with real media remains external evidence |
| Receipts and print queue | Local renderer and virtual printer passed | 40-migration order-to-print E2E; Desktop 43/43; virtual ESC/POS tests | Physical Godex output, cancellation and reprint |
| Godex G500 | Not accepted | Windows queue has 21 jobs with `PagesPrinted=0`; USB descriptor failure `VID_0000&PID_0002` | Repair USB cable/port/driver/device, then observe paper output |
| Desktop update | Local candidate ready | Version `0.1.40`; NSIS installer and matching `latest.yml` built | Publish release; public feed is still `0.1.39`; install/update on a real device |
| Offline/POS/kitchen | Automated acceptance passed | `pnpm release:acceptance`; offline queue, conflict and print tests | Real disconnected POS and kitchen device rehearsal |
| Database recovery | Rehearsed locally | Production dump listed/restored in isolation; all 40 migrations replayed | Final deploy backup/rollback record |
| Production services | Current public smoke failing | `pnpm release:smoke` rerun at 2026-09-23 10:32 Asia/Tashkent: 0/23, all checked hostnames returned HTTP 530 | Fix current public origin/proxy availability, deploy this branch and rerun post-deploy smoke |
| Push/deploy | Not performed | Branch is local and clean | Protected-main merge/push, Dokploy deploy, post-deploy acceptance |

## Release rule

Do not mark the release complete until the physical printer, live Telegram,
published Desktop update, backup/rollback record, and post-deploy smoke rows
have evidence. Local green tests do not substitute for those external checks.
