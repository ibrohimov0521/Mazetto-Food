# MAZETTO FOOD runtime status

Observed at 2026-09-21 Asia/Tashkent. This report distinguishes public health,
code readiness and external/manual proof.

## Production topology

| Component | Runtime/location | Current proof |
| --- | --- | --- |
| Customer web | Cloud service behind `mazettofood.uz` and `www.mazettofood.uz` | Both `/api/health` returned HTTP 200 |
| POS/Admin/Staff web | Cloud service behind `pos.mazettofood.uz` | `/api/health` returned HTTP 200 |
| Backend API | Cloud service behind `api.mazettofood.uz/api/v1` | `/health` returned HTTP 200 and database `ok` |
| Media | MinIO/media service behind `media.mazettofood.uz` | `/healthz` returned HTTP 204 |
| PostgreSQL | Private production service | Indirectly verified by backend health; no destructive/read-write audit query run |
| Redis | Private cache/rate-limit service | Configuration/code present; no public standalone health proof |
| Telegram agent | Cloud `telegram-bot` service | Code/configuration audited; current webhook status requires protected service access or Telegram API credential |
| Telegram staff group | Telegram external service | Requires configured chat ID and legitimate human smoke; not proven in this read-only audit |
| Desktop | Installed on branch Windows devices | Latest public release is `desktop-v0.1.28` |
| Printers | Branch LAN, reached from Desktop over TCP/9100 | No physical printer available; not certified |
| Legacy print agent | Optional branch process | Code exists but Desktop is the intended owner; ownership decision pending |

## Release state

- Main commit observed: `b1b5c6ec5b1804d9dec016099a81ac298d384b57`
  (`fix(web): keep sitemap build resilient (#68)`).
- CI for that commit: passed.
- Deploy for that commit: passed.
- Desktop release: `desktop-v0.1.28`, published 2026-09-21 00:12:55
  Asia/Tashkent (GitHub timestamp 2026-09-20T19:12:55Z).
- Release assets: `latest.yml`, versioned x64 installer, blockmap and stable
  `MAZETTO-Desktop-latest-x64.exe`.

## What is working now

- Public customer, POS/Admin and backend health endpoints are reachable.
- Backend can reach its production database.
- Media service is healthy.
- Desktop updater artifacts exist in the format expected by `electron-updater`.
- Online customer, admin, POS, kitchen, courier, reporting, device and Telegram
  application paths are implemented in the current main code.
- CI/build/deploy automation is operational on the current main commit.

## What is not yet production-certified

- A legitimate customer order through web and through Telegram, observed end to
  end by staff and customer without creating fake production data.
- External payment and refund flow; these are not implemented.
- Desktop offline replay for all command types; confirmed registry mismatches exist.
- Device enrollment as a strict security boundary; a modified client can omit the
  identifying header.
- Multi-printer and cancellation printing with a physical ESC/POS device.
- Database migration/restore repeatability from the restored production snapshot.
- Telegram staff group lifecycle delivery in the current runtime.
- Authenticated browser regression for every role and admin page after deployment.

## Current operational warning

Production migration history and the actual restored database schema are not yet
a trusted single baseline. A recent generic `prisma migrate deploy` caused a
backend outage and a targeted print-queue bootstrap was used to recover. Until a
backup/restore rehearsal and migration baseline reconciliation are complete, do
not run broad production migrations as a routine deploy step.
