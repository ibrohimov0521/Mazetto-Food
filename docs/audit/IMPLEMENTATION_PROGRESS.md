# Audit remediation implementation progress

Last local checkpoint: 2026-09-21 06:20 Asia/Tashkent.

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
- Backend tests: 224 passed.
- Desktop typecheck passed.
- Desktop tests: 38 passed, including command registry, virtual printer and mutation-contract tests.
- POS typecheck and lint passed.
- Full workspace `pnpm verify`: 18/18 Turbo tasks passed.
- Operations validators: 28/28 passed.

## Second local remediation batch

- `AUD-101` partial: all 37 migrations were applied twice to an isolated clean
  PostgreSQL 18 database and historical migration checksums are now enforced by
  `pnpm validate`. A restored-production-copy rehearsal remains mandatory.
- `AUD-114`/`AUD-115`: Desktop reports/tests every managed printer; the receipt
  queue exposes errors and audited dead-letter/stale-job retry.
- `AUD-116`: Desktop is canonical; the legacy print-agent is inert unless an
  explicit opt-in environment flag is set.
- `AUD-117` automation portion: a virtual TCP ESC/POS printer proves one-time
  cancellation output, long-item bytes and cut bytes. Physical 58/80 mm testing
  is still a human release gate.
- `AUD-122`/`AUD-123`/`AUD-124`: operational roles require enrolled Desktop
  credentials, the remembered staff session is encrypted with Windows
  `safeStorage`, and a redacted support bundle can be exported.
- `AUD-125`: every backend staff mutation is classified by an AST contract test
  as queueable or explicitly online-only.
- `AUD-130` safety gate: only CASH is exposed/accepted until signed provider
  integrations exist; fake successful card/Click/Payme payments are blocked.
- `AUD-132`/`AUD-133`: ingredient and warehouse edit/archive lifecycle,
  reference/stock protection, Admin controls and branch readiness were added.
- `AUD-134` was verified as already implemented: modifiers have an explicit
  reversible active/archive lifecycle.
- `AUD-135`: bounded four-digit random identifiers were replaced with UUID
  entropy while retaining human-readable prefixes.
- `AUD-142`: media upload authorization is purpose-aware; homepage managers can
  upload only homepage assets and catalog editors only catalog assets.
- `AUD-144`: kitchen seed permissions no longer include shift/cash ownership.
- `AUD-150`: customer order polling backs off to two minutes while its scoped
  authenticated realtime socket is healthy and returns to 15 seconds offline.
- `AUD-154`: the protected system-health view includes timeout-bounded,
  credential-redacted geocoding and media dependency readiness.

Current verification: backend 224 tests passed, Desktop 38 tests passed, all
18 workspace typecheck/lint/build tasks passed, and all 28 operations validators
passed.

## Remaining release gates

1. `AUD-101`: obtain a current production backup, restore it to isolation,
   reconcile `_prisma_migrations`, and rehearse deploy plus rollback. No
   production migration or deploy before this gate.
2. `AUD-102`, `AUD-152`, `AUD-160`, `AUD-161`: complete recorded cross-surface
   and role/browser acceptance, including Telegram group and disposable full
   order-to-cash-to-stock-to-print E2E.
3. `AUD-117`: perform physical 58/80 mm printer acceptance when hardware exists.
4. `AUD-130`, `AUD-131`: signed Click/Payme/Card integrations and permissioned
   refund/void accounting remain unimplemented and disabled.
5. `AUD-140`, `AUD-141`, `AUD-143`: normalize route metadata, move browser
   refresh sessions to HttpOnly SameSite cookies, and add explicit page intent
   to the route manifest.
6. `AUD-151`, `AUD-153`, `AUD-155`: finish Telegram ownership evidence,
   production alert/SLO ownership and runtime CORS drift checks.
7. `AUD-162`, `AUD-163`: customer PWA decision and courier proof-of-delivery are
   later product decisions, not current core release claims.
8. Only after the blocking gates: bump Desktop version, build/publish update,
   run release smoke, then perform the single requested push/deploy.
