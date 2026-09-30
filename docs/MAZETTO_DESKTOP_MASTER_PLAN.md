# MAZETTO Desktop master plan

## Product role

MAZETTO Desktop is the local operational runtime for a branch. It is not a
second independent backend and it is not only a print agent. The cloud backend
remains the source of truth; Desktop keeps an authorized local projection,
accepts safe offline commands, synchronizes them when connectivity returns and
owns local peripherals such as receipt printers.

The same role-aware `pos-web` interface is used inside the native shell so the
admin, cashier, waiter, kitchen, courier and accounting panels do not fork into
separate products.

## Non-negotiable rules

1. The local database is a projection, never an untracked production fork.
2. Every offline write has an idempotency key, actor, device, branch, base
   version and creation time.
3. Money, stock and order-state conflicts are resolved by explicit server
   rules. Last-write-wins is forbidden for business data.
4. Destructive or security-sensitive operations require a live server unless
   a dedicated offline contract exists.
5. A logical print job is printed by one leased agent attempt. Reprint is a new,
   audited action; it never silently resets the original job.
6. Tokens and local business data are encrypted at rest with an OS-bound key.
7. The desktop gateway listens on loopback only and never exposes a branch
   database or printer to the public network.
8. Offline capability is permission-aware and branch-scoped.

## Delivery phases

### D0 - Desktop foundation

- Electron shell with single-instance protection and hardened BrowserWindow.
- Local loopback API gateway.
- SQLite WAL database with schema migrations.
- GET snapshot cache and explicit offline response headers.
- Connectivity, cache, outbox and print-queue diagnostics.
- Local development boot and Windows packaging skeleton.

Acceptance: the local POS UI opens in a native window; an already-read JSON API
resource remains available after the upstream API is stopped; no bearer token
is persisted in the cache.

### D1 - Device enrollment and security

- Admin-created branch device enrollment code.
- Device identity and revocable, scoped device credential.
- OS keychain/DPAPI storage for refresh material and the local database key.
- Session lock, auto-lock and staff switch without closing the runtime.
- Server-side device status, last-seen, version and remote revoke.

Acceptance: a revoked device cannot sync or lease print work; copied local files
cannot be opened on another Windows account.

### D2 - Offline read model

- Versioned bootstrap snapshot for branch, menu, modifiers, halls, tables,
  employees, settings and printer routing.
- Incremental sync cursor based on immutable domain events.
- Atomic projection updates and resumable snapshot download.
- Per-panel freshness indicator: live, cached, syncing, stale or blocked.
- Bounded retention and safe cache compaction.

Acceptance: every authorized panel renders useful branch-scoped data with the
internet disconnected and clearly shows when each dataset was last updated.

### D3 - Offline command outbox

- Typed command registry instead of arbitrary HTTP replay.
- Idempotent commands for POS order creation, waiter supplements, kitchen
  actions, courier actions, payments and cash handovers.
- Dependency ordering, retry policy, exponential backoff and dead-letter state.
- Optimistic local projection with server acknowledgement or compensation.
- Conflict inbox with human-readable comparison and permitted resolutions.

Acceptance: killing the app during a write cannot lose or duplicate the command;
reconnection converges to the server state in deterministic order.

### D4 - Live synchronization

- Authenticated WebSocket channel for low-latency events.
- Cursor catch-up after every reconnect so WebSocket loss cannot lose data.
- Heartbeat, clock-skew measurement and connection quality state.
- Background sync while the native window is minimized.
- Event fan-out to all open role workspaces.

Acceptance: website and Telegram orders appear on the branch desktop in real
time; reconnecting after a gap applies every missed event exactly once.

### D5 - Durable printing

- Backend `PrintJob`, lease and append-only `PrintAttempt` contracts.
- Branch/station/product routing for cashier, kitchen, bar and courier outputs.
- Desktop printer discovery, test page, paper width and encoding configuration.
- ESC/POS USB, Windows spooler and TCP adapters behind one driver interface.
- Automatic print for web, Telegram, POS and waiter order events.
- Retry, lease expiry, dead-letter queue and audited manual reprint.
- Print preview and exact payload snapshot retained with the logical job.

Acceptance: process, network and printer restarts do not lose a job and do not
silently print one logical ticket twice.

### D6 - Complete offline role coverage

- Cashier: shift, order, payment, return and cash operations.
- Waiter: halls, tables, order creation and supplemental kitchen tickets.
- Kitchen: station queues and versioned item actions.
- Courier: assignment, delivery status and cash custody.
- Admin: catalog, staff, branches, registers, reports and settings projections.
- Accountant: shifts, transfers, expenses, reconciliation and exports.

Admin writes are classified individually. Security, role, credential and schema
changes remain online-only until a dedicated conflict-safe protocol is approved.

### D7 - Windows productization

- Signed installer, per-machine/per-user install decision and Start menu entry.
- Auto-start option, tray state and controlled background operation.
- Signed staged auto-update with rollback and minimum-supported-version policy.
- Crash recovery, structured local logs and redacted diagnostics export.
- Database backup, corruption detection, repair and safe reset/rebootstrap.

#### Desktop update contract

The Electron shell uses `electron-updater` with a generic HTTPS feed. The feed
is configured at runtime with `MAZETTO_DESKTOP_UPDATE_URL`; an absent URL keeps
development and not-yet-provisioned installations stable with updates disabled.
The release directory must publish the installer, its generated update
metadata, and the matching blockmap under the same feed path. Updates are
never downloaded automatically: the user sees an available version, starts the
download, and explicitly restarts to install it. The updater is disabled for
unpacked development runs, and update failures leave the current installation
usable.

Before production rollout, the release pipeline must add code signing, a
minimum-supported-version policy, staged channels, checksum monitoring and a
tested rollback artifact. A feed must never point at an unsigned or partially
uploaded release.

### D8 - Observability and rollout

- Admin device dashboard: online state, sync lag, queue depth, app version,
  printer state and last successful job.
- Alerts for stale devices, dead-letter commands and blocked printers.
- Canary at one branch, then cashier, kitchen and full branch rollout.
- Offline, reconnect, power-loss, duplicate-event and printer-failure drills.
- Legacy Node print-agent remains a canary until Desktop printing is proven, then
  is retired without running both paths for the same printer route.

## Offline write policy

| Class                | Initial policy                             | Examples                              |
| -------------------- | ------------------------------------------ | ------------------------------------- |
| Read projections     | Cache and refresh                          | catalog, orders, staff, reports       |
| Operational commands | Queue after D3 contract                    | order, kitchen, courier               |
| Financial commands   | Queue only with open shift and idempotency | payment, handover                     |
| Configuration        | Versioned conflict review                  | menu, tables, printer routing         |
| Security/destructive | Online-only by default                     | role change, delete user, token reset |

## First implementation slice

The first slice creates `apps/desktop`, a loopback gateway and the local SQLite
schema. It caches successful JSON GET responses and persists safe operational
mutations in a local outbox when the upstream API is unavailable. The first
offline command slice covers branch operations that already carry an
idempotency key or can be made idempotent by the desktop gateway: POS order
creation, payment processing, shift open/close, cash transfers, waiter order
item/status actions, kitchen actions and courier status updates. Commands are
replayed with the current authorized session for the same user/branch scope
when connectivity returns. If the app stops while a command is being sent, the
next launch moves it back to pending so it can retry instead of becoming stuck.
The reconnect health probe also starts a flush for the last active in-memory
session, so the cashier does not need to press refresh after internet returns.
The POS top bar can now open the local outbox, show blocked commands and let an
operator retry or remove a command from the queue. Removing a command is an
explicit local operator decision; it prevents that queued HTTP mutation from
being replayed and does not pretend the server accepted it.

This is still a D3 slice, not the full D3 finish line. The remaining work is
the typed command registry, dependency mapping between locally-created IDs and
server IDs, optimistic projections for every panel, full conflict comparison
and server-side compensation rules. The shell also contains the safe update
lifecycle, but it remains inactive until an HTTPS feed is provisioned.

## Offline reliability checkpoint (2026-09-30)

- Desktop offline gateway opens its circuit after a failed request and serves cached reads or local queued writes without repeating a long upstream wait. The maximum upstream request wait is five seconds.
- POS sale/payment completion now distinguishes locally queued work from server-confirmed work. Offline payment processing accepts positive CASH tenders only; non-cash methods remain online-only. A final server receipt link is not shown before synchronization.
- The POS cart draft now preserves its checkout idempotency key and order/tender context across a page reload; legacy cart-only drafts remain readable. This reduces duplicate-sale risk for a retry of the same checkout but does not make every POS action offline-capable.
- The local printer queue supports multiple Windows-installed printers, role routing and paper widths, plus direct ESC/POS network printers. Failed local print jobs are visible in Desktop controls and can be retried after the printer is fixed.
- Staff panels receive live/cache source and timestamps through the native Desktop fallback. Event cursors now persist in SQLite by user, panel and branch, and advance page by page; localStorage remains a fallback. This preserves catch-up progress but still triggers data refetches rather than atomically applying a versioned offline projection, so the D2 snapshot contract remains unfinished.
- Staff cache freshness changes from `cached` to `stale` at 15 minutes, refreshes its age label once per minute, and treats missing timestamps as stale. Freshness now follows the staff page where the cached response was consumed, so a cached POS request does not imply that the kitchen page also has offline data. This remains an operator warning, not proof of business-data validity.
- Desktop release versions are incremented for POS/Desktop payload changes, release tags are immutable, and release jobs are serialized so clients can discover actual updates instead of silently reusing an old version.
- Desktop enforces the existing 30-day and 5,000-response-per-scope cache bounds at startup as well as after writes. Startup cleanup touches only expired/excess API-cache rows; command and print queues are preserved.
- Verification for this checkpoint: Desktop tests, POS checkout-draft and freshness tests, POS typecheck/build, plus printer routing/failure recovery tests. Windows release packaging runs on the repository's Windows GitHub Actions runner after merge.
- This is not a claim of 100% offline operation. Cached reads require prior authorized synchronization; customer browser ordering and unsupported/configuration/security actions still require the server. Only Windows-driver-compatible printers and supported ESC/POS network devices are covered; physical validation is still needed for the restaurant's exact models.
- Remaining Desktop phases D2-D6, physical printer/power-loss drills, signed staged updates and rollback remain release gates.

## D2 POS catalog bootstrap fallback (2026-09-30)

- Bootstrap schema v2 includes the authenticated branch's active POS catalog, effective payment methods and active tables in the same repeatable-read response as its revision cursor.
- The Desktop gateway already stores each successful JSON response as one scoped SQLite cache row. If the POS catalog endpoint is unavailable, the POS terminal can use that previously authorized bootstrap response after validating schema version, timestamp and the open shift's branch.
- Catalog filtering follows POS visibility and stock-availability rules. Snapshot mismatch, malformed data, unsupported versions and cross-branch data fail closed.
- Verification: backend bootstrap tests, POS snapshot-validation tests, backend/POS typecheck, POS lint, full backend/POS/Desktop test suites, affected production builds and 33 repository validators passed.
- This only improves offline POS catalog reads after a successful authorized bootstrap. It does not enable offline login, an uncached shift, card/terminal payments, arbitrary admin writes, or all staff panels. It is not a 100% offline guarantee; D2 and later offline phases remain open, as do physical printer acceptance and outage/power-loss drills.

## D3 ambiguous-request idempotency gate (2026-09-30)

- A command may be queued without a caller-provided idempotency key only when the Desktop gateway had already marked the upstream offline and therefore did not send that request.
- If a request was attempted and the connection failed before a response arrived, it is queued only when the original request already had a stable idempotency key. This avoids replaying a command with a newly generated key after the server may already have committed it.
- Existing branch/user scoping, cash-only offline payment restrictions, and explicitly supported command routes remain unchanged.
- Verification: Desktop command suite and full monorepo CI passed; the regression test simulates a connection reset after sending a keyless POS command and verifies no outbox row is created.
- This tightens duplicate prevention but does not complete D3: route-by-route idempotency guarantees, dependency ordering, projections, conflicts, and replay acceptance still need dedicated validation.

## D3 cash-ledger idempotency (2026-09-30)

- The two supported shift cash-transaction routes now accept the Desktop idempotency header and scope it to the acting user and shift.
- The ledger write and completed idempotency record commit in the same database transaction. A replay returns the original transaction; reusing the key with a different request is rejected.
- No schema migration is needed; this uses the existing idempotency request ledger. Requests without a key retain the existing online behavior, while Desktop-queued requests always include the persisted key.
- Verification: cash transaction replay, payload mismatch, tenant/branch link validation, backend tests and full monorepo CI passed.
- This protects cash-in/out ledger rows only. Shift open/close, cash transfers, courier state and other queueable routes still need server-side idempotency before the entire D3 queue is considered safe.

## D3 cash-transfer creation idempotency (2026-09-30)

- Both cashier and courier-shift transfer-creation routes forward the Desktop idempotency key and correlation id.
- The transfer, its source-balance allocation snapshot, cash-out ledger row and completed idempotency record are committed together. A replay resolves to the original transfer; a changed payload with the same key is rejected.
- Existing actor/tenant/branch filters are applied when returning a replay. No schema migration is required.
- Verification: transfer replay and payload-mismatch tests, full backend suite, and monorepo CI passed.
- Transfer acceptance/rejection now have separate actor-, action-, and transfer-scoped replay contracts; ledger writes and the completed idempotency row share one transaction.
- Shift open/close and courier status now have server-side replay contracts; waiter order mutations and kitchen transitions remain route-by-route gates.

## D3 cash-transfer resolution idempotency (2026-09-30)

- Accept and reject routes forward Desktop's persisted idempotency key and correlation id.
- Accept/reject results and their CASH_IN ledger entries commit atomically with the completed idempotency record. A retry returns the original branch-scoped result without a second ledger write.
- Reusing a rejection key with a different reason is rejected; acceptance replay is restricted to the accepting user and their receiver shift.
- Verification: acceptance/refund replay tests, payload-mismatch test, full monorepo CI and production smoke passed.
- Courier status is covered by the D3 courier retry checkpoint below; remaining D3 gates are still listed separately.

## D3 shift lifecycle idempotency (2026-09-30)

- Cashier shift open, courier-shift open alias, and the legacy shifts open route pass the Desktop idempotency key and correlation id to one shared service operation.
- Shift creation, opening-balance ledger entry, and idempotency completion commit together. A replay is scoped to the same actor, branch, employee, and request payload.
- Shift close is similarly replay-safe: closing totals, closing-balance ledger entry, and the completed idempotency record commit in one serializable transaction. Retries return the same closed shift without recalculating or writing another closing row.
- Verification: shift open/close replay tests, full monorepo CI and production smoke passed.
- Order/kitchen transition coverage, dependency mapping and offline projections remain separate release gates.

## D3 courier status idempotency (2026-09-30)

- Courier status endpoints forward Desktop's persisted idempotency key and correlation id while preserving existing keyless online requests.
- The key is scoped by tenant, customer order and courier; changing status or tender details under a reused key is rejected.
- Courier payment creation, order status/history, kitchen synchronization, outbox event and completed idempotency result commit in one database transaction. A replay returns the tenant-scoped order without repeating payment or realtime notifications.
- Existing body-provided courier idempotency keys remain supported for older clients.
- Verification: courier replay, transaction atomicity and changed-payload tests (3/3); full monorepo CI and 33 validators passed. Production deploy and 24/24 smoke completed.
- This closes the courier-status idempotency slice only. Dependency ordering, offline projections, conflict resolution, receipt delivery and physical printer/power-loss acceptance remain open.

## D3 waiter order-mutation idempotency (2026-09-30)

- Order item add/update and legacy status routes forward the desktop idempotency key, correlation id and expected aggregate version.
- The mutation and completed idempotency record commit in the same database transaction. Replays read the current order within the actor's tenant/branch scope and do not repeat status notifications.
- Courier updates include the expected order version in the request hash and reject stale writes before recording payment or changing status.
- The waiter, admin-online-orders and courier screens submit the version they last read; the bundled Desktop UI is released as `0.1.60`.
- Desktop outbox mutations are serialized per aggregate. An unresolved earlier command blocks later commands for that same order, while unrelated orders continue; after acknowledgement, pending commands are rebased to the server's current order version in the local SQLite transaction.
- Verification: 4 focused order-mutation tests, 21 Desktop gateway tests, 487 backend tests plus 3 retry tests, full GitHub CI passed, Desktop 0.1.60 was published, production deploy completed, and production smoke passed 24/24. Physical offline acceptance remains a separate restaurant-device test.

## D3 kitchen-action transactional idempotency (2026-09-30)

- Kitchen accept/start/ready/complete/cancel now complete their idempotency record inside the same database transaction as the order and ticket transition.
- If the idempotency completion write fails, the action transaction fails too; a lost response after a successful commit can be replayed without repeating ticket events or notifications.
- No database schema change is required. Existing version checks, order row locking, tenant scope and event emission behavior are preserved.
- Verification: 10 focused kitchen hardening tests, including concurrent duplicate acceptance, replay and transactional-completion failure; full monorepo CI and repository validators passed.
- Offline D3 still requires dependency mapping, complete supported-route coverage and conflict/replay acceptance. Physical kitchen-device outage drills remain separate.

## D3 offline order dependency sequencing (2026-10-01)

- POS and waiter offline order creation now use the canonical `orders` aggregate, matching later order status, kitchen and item commands that reference the local order ID.
- A pending, sending, conflicted or dead-lettered creation blocks only later commands for that same local order. Independent orders remain eligible for synchronization.
- Verification: command registry tests assert both creation routes share the order aggregate; Desktop gateway regression tests cover a conflicted first order with a dependent command and a second independent order.
- Desktop bundle version: `0.1.62`. Deployment workflow and direct 24/24 production smoke passed; physical multi-device outage testing remains open.

## D3 offline kitchen action replay (2026-10-01)

- Cached kitchen tickets project queued accept/start/ready/complete/cancel states and the next ticket version immediately, marked as pending synchronization.
- Kitchen commands remain serialized per ticket. After each server acknowledgement, later pending actions for that ticket receive the acknowledged version inside one SQLite transaction, preventing stale-version replay conflicts.
- Version extraction accepts both direct ticket responses and responses nested under a `ticket` field.
- Desktop bundle version: `0.1.63`. PR #155 merged; full monorepo CI, Desktop release, deploy and 24/24 production smoke passed. Physical kitchen-device outage acceptance remains open.

## D3 offline kitchen cache reconciliation (2026-10-01)

- A successfully replayed kitchen action updates matching cached kitchen-board snapshots with the server-confirmed ticket status and version, then clears `pendingSync`.
- Cache reconciliation is restricted to the authenticated user/branch cache scope and committed atomically with the outbox acknowledgement and dependent-version rebase.
- If later actions for the same ticket remain queued, normal optimistic projection overlays them and keeps the ticket marked pending until the last action is confirmed.
- Desktop bundle version: `0.1.64`. Focused replay/cache tests, full CI, release, deploy and production smoke are required before closing this stage; physical restaurant-device acceptance remains open.

## D4 printer deadlines and duplicate-safe recovery (2026-09-30)

- Windows rendering, the hidden print window and the Electron driver callback now have bounded deadlines. ESC/POS TCP connect/write is bounded too; a printer that stops responding can no longer wait forever.
- A timeout after print submission is recorded as an ambiguous outcome and moved directly to manual review instead of being automatically retried. This avoids silently printing duplicate customer/kitchen slips when the driver may already have accepted the job.
- Successful delivery is tracked per configured printer and job in the Desktop SQLite database. If a multi-printer route partially succeeds and another printer fails, retries skip printers already confirmed successful. The operator can inspect ambiguous output before explicitly retrying it.
- The Desktop queue continues with other due jobs after a printer failure or timeout; retries for definitely failed jobs retain their bounded backoff.
- The Windows Desktop bundle version for this stage is 0.1.61.
- Verification: Desktop tests 77/77, print-queue service tests 3/3, full monorepo typecheck/lint/test/build and 33/33 validators passed; production deploy and 24/24 smoke succeeded. Restaurant-specific physical printer tests remain required; this does not claim support for every printer model or a 100% offline guarantee.
