# Production checkpoint - 2026-10-05

This record supersedes the 2026-10-03 checkpoint for the latest customer-web
release. Older audit records are historical evidence and can contain stale
deployment statements.

## Deployed and verified

- PR [#223](https://github.com/ibrohimov0521/Mazetto-Food/pull/223) added
  Uzbek/Russian customer-web localization and route-validator updates. PR #224 fixed the Russian
  menu heading and added a regression assertion. Both are merged.
- Main CI #37230395430 and production deploy #37230607123 passed. Main and the
  remote production tag point to 776577b5a3c08e1eb10633bc3414be7b412638cf.
- Post-deploy browser checks covered home, menu, cart, checkout, orders and
  profile in both languages at 390px and 1440px: 24 combinations. All returned
  successfully, document language was correct, and no page errors or horizontal
  overflow appeared.
- This release had no database migration and did not update the Windows Desktop
  app. It did not test authenticated transactions or change payment, DNS, or
  tenant activation settings.
- Read-only Prisma migration checks on production and staging both reported
  58/58 migrations applied and no pending migrations. This is not a restore or
  rollback rehearsal.
- A literal-text scan of the running backend container's latest 12 hours of
  logs found no "Internal server error" or "Invalid credentials" entries; this
  does not reproduce or close the earlier authenticated failures.

## Remaining acceptance and implementation

- Reproduce production staff login, phone-verification, checkout and POS errors
  using request IDs and sanitized backend logs. A successful page response does
  not prove the failing authenticated action works.
- Test a real non-superadmin employee's role/branch permissions and a controlled
  customer order through Telegram and the staff-group lifecycle.
- Review the full customer journey and BestTeam owner dashboard visually on
  mobile and desktop. The recent 24 checks covered customer routes only; they
  did not re-accept the BestTeam background/logo contrast or crop.
- Desktop offline support is partial; customer checkout is online-only. Test
  disconnect, reconnect, queue recovery and physical 58/80 mm printer routing on
  the restaurant's actual Windows hardware.
- Click/Payme/card initiation, callbacks, reconciliation and provider refunds
  remain disabled pending merchant configuration and signed-callback tests.
  Partial-item refund rules remain open.
- Tenant-scoped PostgreSQL outbox worker is implemented and deployed; tests passed 7/7.
- It uses leases, ordering guards and safe retry/backoff; uncertain outcomes go to dead letters, not blind resend.
- Live order acceptance and per-restaurant bot/webhook configuration remain open.
- admin.mazetto.uz is BestTeam Control; mazettofood.uz remains one restaurant
  product. Monitoring and DNS TXT ownership proof do not complete tenant
  provisioning or cross-tenant authorization. Keep second-restaurant
  activation disabled until trusted host identity, membership and A/B isolation
  across APIs, jobs, media, realtime, bots and reports pass.
- Restore/rollback evidence, independent operational alert routing, courier
  proof-of-delivery policy, and up-to-date audit documentation remain open.

## Human gates, in order

1. Reproduce login/OTP/POS errors and validate a real non-superadmin account.
2. Run a controlled restaurant order and Telegram staff lifecycle test.
3. Approve customer and BestTeam visuals on mobile and desktop.
4. Accept offline recovery and physical printer behavior on restaurant devices.
5. Configure and accept online payment providers if they are needed.
6. Do not activate a second tenant until the isolation gate passes staging A/B
   tests and backup/rollback evidence is recorded.
