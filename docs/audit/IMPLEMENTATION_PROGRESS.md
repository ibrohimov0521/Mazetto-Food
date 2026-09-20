# Audit remediation implementation progress

Last local checkpoint: 2026-09-21 01:48 Asia/Tashkent.

This file tracks implementation before the requested final combined push and
deploy. Changes below are intentionally local until the whole release batch is
ready and its database rollout has been rehearsed.

## Implemented and automated-test verified locally

- `AUD-110`: receipts now have `documentType`; uniqueness is
  `(orderId, documentType)`, allowing one sale and one cancellation document.
- `AUD-111`: Desktop discovers active ONLINE printers with usable host metadata
  and claims only their jobs. Unassigned jobs are claimed only when a fallback
  printer is configured.
- `AUD-112`: Printers is visible in the `Kassa va hisobot` sidebar group and the
  navigation validator covers it.
- `AUD-113`: audited `DELETE /printers/:id` performs history-preserving
  deactivation and the Admin action uses it.
- `AUD-118`: ESC/POS rendering uses the immutable receipt content snapshot;
  legacy rows retain a compatibility fallback.
- `AUD-119`: a receipt becomes printed only after all of its non-cancelled jobs
  are printed; reprint resets the aggregate print flag.
- `AUD-120`: all kitchen offline actions match backend PATCH routes.
- `AUD-121`: item cancellation and cash-transfer accept/reject have exact typed
  offline command definitions and regression tests.
- `AUD-123`: the Desktop device credential is encrypted with Electron
  `safeStorage` (Windows DPAPI) instead of being stored as plaintext in SQLite.
- Device hardening portion of `AUD-122`: enrollment issues a random 256-bit
  device secret, only its hash is stored server-side, official Gateway and print
  worker send it, and the backend uses constant-time verification.

## Added database changes

- `20260921020000_receipt_documents`
- `20260921023000_device_credentials`

These migrations have not been applied to production. Existing enrolled Desktop
devices need a coordinated one-time re-enrollment after the credential migration.

## Verification completed

- Backend typecheck passed.
- Backend tests: 216 passed.
- Desktop typecheck passed.
- Desktop tests: 29 passed, including new command registry and printer claim tests.
- POS typecheck and lint passed.
- Full workspace `pnpm verify`: 18/18 Turbo tasks passed.
- Operations validators: 27/27 passed.

## Next work after usage reset

1. Rehearse both migrations against a restored production backup and complete
   `AUD-101`; do not deploy before this gate.
2. Finish `AUD-122` policy for Desktop-required roles/endpoints so omitting all
   Desktop headers cannot bypass enrollment without breaking ordinary Admin web.
3. Finish `AUD-114` multi-printer Desktop status/configuration UX and per-printer
   connectivity test; retain Admin as assignment source of truth.
4. Complete `AUD-115` queue recovery/operator errors and add receipt/claim service
   integration tests around stale leases and dead letters.
5. Bump Desktop version, prepare coordinated re-enrollment instructions, then
   continue the remaining audit gates before one final push/deploy.
