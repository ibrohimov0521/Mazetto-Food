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

## D2 offline order documents reuse branch bootstrap (2026-10-01)

- When the POS catalog endpoint has not yet been cached, queued offline orders now reuse the authenticated realtime bootstrap catalog to build accurate local order, receipt and kitchen snapshots.
- The fallback requires both the snapshot and embedded catalog to match the active JWT branch and contain product/table collections; missing or cross-branch data is not used.
- Verification: a reconnect integration test checks that an offline queued sale retains product, variant and table labels from the bootstrap snapshot; full CI, Windows release and production smoke are release gates.
- Desktop bundle version: 0.1.70.

## D1 offline cache follows current authorization (2026-10-01)

- Desktop API-cache scopes fingerprint branch, tenant, membership, credential version, roles and effective permissions without persisting the bearer token.
- Reordered but equivalent role/permission claims share the cache; reduced access or another tenant membership receives a separate cache and cannot read the earlier scope.
- Pending outbox commands retain the legacy user/branch scope so a permission refresh does not strand sales; replay uses the latest session token and remains subject to server authorization.
- Verification: a permission-refresh regression confirms private cached data stays isolated while a queued sale replays once under the reduced-permission token. Full CI, Windows release and production smoke passed.
- Desktop bundle version: 0.1.72.

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
- Desktop bundle version: `0.1.64`. PR #156 merged; full CI, Desktop release, deploy and 24/24 production smoke passed. Physical restaurant-device acceptance remains open.

## D3 offline cash shift lifecycle (2026-10-01)

- Register and courier-shift opens now receive durable local IDs; subsequent close/transaction URLs and bodies resolve those IDs to server IDs after the opening command is acknowledged.
- Cash-register and shift commands are serialized by branch, so dependent register actions cannot overtake an offline shift open or courier-shift open.
- Cached current-shift reads project queued opens/closes; successful replay reconciles the scoped cache, including creating a snapshot when none existed.
- Outbox optimistic projections use SQLite row order as a deterministic tie-breaker when commands share a timestamp.
- Desktop bundle version: `0.1.65`. PR #157 merged; full CI, Desktop release, deploy and 24/24 production smoke passed. Physical register-device acceptance remains open.

## D5 printer paper profiles and driver-independent label sizing (2026-10-01)

- Each installed Windows printer can be assigned a receipt role and explicit paper profile: thermal roll, A4 sheet, or custom-size label with width and height in millimeters.
- Rendering and Windows spooler page sizes use the selected profile rather than assuming a specific printer brand. Legacy Godex settings are migrated to their prior 90 x 80 mm label behavior.
- USB, Bluetooth, and network-connected printers remain usable through an installed Windows driver; direct network ESC/POS remains available for supported devices.
- This improves format compatibility, not universal hardware/protocol support. The exact printer model, Windows driver, paper and cutter still require a physical test print at the restaurant.
- Desktop bundle version: `0.1.66`. PR #158 merged; full CI, Desktop release, deploy and 24/24 production smoke passed. Restaurant-specific physical printer tests remain open.

## D3 offline cash transactions and shift cache reconciliation (2026-10-01)

- Cash-in/out transactions queued during an outage immediately appear in the current-shift transaction history and update the projected cash balance using the same incoming/outgoing rules as the server.
- Duplicate submissions with the same idempotency key remain one outbox command. Transactions queued against a locally opened shift wait for that shift's server ID and replay in branch order.
- Each acknowledged transaction updates the scoped cached shift snapshot atomically with outbox acknowledgement. A later outage keeps the confirmed transactions and balance instead of falling back to the pre-transaction snapshot.
- Desktop bundle version: `0.1.67`. Full Desktop tests, typecheck, lint, build, CI, release, deploy and production smoke are required; physical register acceptance remains separate.

## D3 offline cash handover creation (2026-10-01)

- Cash handover creation carries a stable idempotency key across retries. While offline, the gateway checks the cached open shift, subtracts earlier queued handovers from the available cash, and refuses amounts above that projection or receivers absent from the cached open-receiver list.
- A queued handover immediately appears as pending synchronization in the sender's history and reduces the projected cash balance. Server acknowledgement reconciles the outgoing-transfer list and cash-out ledger into the scoped shift cache without double-debiting if a server refresh already included the transfer.
- Accept/reject remains online-only because either action changes two employee shift ledgers and cannot be reconciled safely from a stale offline snapshot.
- Desktop bundle version: `0.1.68`. Automated transfer replay, duplicate-key, overdraw, offline accept/reject, full monorepo CI, deployment smoke and release checks are required; two-device physical reconciliation remains open.

## D3 offline shift-close guard for pending handovers (2026-10-01)

- A register shift cannot be closed offline while the cached/projected outgoing handover list contains an unacknowledged transfer. The gateway fails closed before queueing the close, avoiding a guaranteed server conflict after reconnect.
- The POS shift screen disables close and explains that the receiving cashier must accept or reject the handover after connectivity returns. The gateway guard covers other Desktop clients as well as this screen.
- Verification: offline transfer-plus-close regression, Desktop typecheck/lint/tests, POS typecheck/lint/build, monorepo CI, release and post-deploy smoke. Physical cashier/receiver acceptance remains an on-site test.
- Desktop bundle version: `0.1.69`.

## D4 printer deadlines and duplicate-safe recovery (2026-09-30)

- Windows rendering, the hidden print window and the Electron driver callback now have bounded deadlines. ESC/POS TCP connect/write is bounded too; a printer that stops responding can no longer wait forever.
- A timeout after print submission is recorded as an ambiguous outcome and moved directly to manual review instead of being automatically retried. This avoids silently printing duplicate customer/kitchen slips when the driver may already have accepted the job.
- Successful delivery is tracked per configured printer and job in the Desktop SQLite database. If a multi-printer route partially succeeds and another printer fails, retries skip printers already confirmed successful. The operator can inspect ambiguous output before explicitly retrying it.
- The Desktop queue continues with other due jobs after a printer failure or timeout; retries for definitely failed jobs retain their bounded backoff.
- The Windows Desktop bundle version for this stage is 0.1.61.
- Verification: Desktop tests 77/77, print-queue service tests 3/3, full monorepo typecheck/lint/test/build and 33/33 validators passed; production deploy and 24/24 smoke succeeded. Restaurant-specific physical printer tests remain required; this does not claim support for every printer model or a 100% offline guarantee.

## D2 freshness identity isolation (2026-10-01)

- Staff-panel cache freshness indicators are now scoped by user, employee, tenant, membership, credential version, branch, global scope and normalized effective roles/permissions. A membership or credential change no longer inherits another session's cached/live indicator for the same endpoint.
- This scopes status metadata only; the Desktop gateway remains responsible for tenant/branch authorization and cached response isolation.
- Verification: freshness tests cover tenant, membership, employee and credential-version changes, plus order-independent duplicate-free role/permission sets. Full monorepo CI, Desktop release, deployment smoke and production smoke are required before rollout.
- Desktop bundle version: `0.1.73`. Atomic offline projections, per-role field coverage, physical printer/power-loss acceptance and universal printer protocol support remain open; this is not a 100% offline guarantee.

## D3 offline waiter table orders (2026-10-01)

- Waiters can open a table and add an item while offline when the authorized table, same-branch menu price, selected variant and modifiers are present in the local cache. The gateway refuses incomplete or uncached pricing instead of inventing a total.
- The local table becomes occupied in the optimistic projection, and its order/item appear immediately with a visible pending-sync state. Reconnect replays table creation before item creation and substitutes the server order ID.
- A stable idempotency key is retained for ambiguous retries. Waiter line edits, quantity changes and removal stay disabled until the local line has a server-confirmed identity.
- Kitchen Display offline projection now follows the real API envelope with nested data.items. Waiter-created tickets include cached table name and DINE_IN type; added items update ticket.items and the nested order without duplicating lines.
- Verification: Desktop tests 88/88, Desktop typecheck and lint, full monorepo CI, Windows Desktop 0.1.75 release and production tag passed. Dokploy completed without rebuilding server apps; production web smoke was skipped because this change did not modify a server service. Physical offline tests across separate terminals remain open.
- Desktop bundle version: 0.1.75.

## D2 exact cached endpoint matching (2026-10-01)

- Offline fallback lookups now verify the cached URL pathname exactly, so a newer detail route such as `/orders/:id` cannot replace a collection response such as `/orders`. Query variants of the exact endpoint still use the newest response.
- Added regression coverage for overlapping collection and detail routes.
- Verification: Desktop tests 89/89, typecheck and lint, full CI, Windows Desktop 0.1.76 release and production tag passed. Dokploy completed without rebuilding server apps; production web smoke was skipped because no server service changed.
- This does not complete D2: atomic grouped snapshots, per-role field coverage, outage drills and physical printer acceptance remain open.
- Desktop bundle version: `0.1.76`.

## D2 branch-validated offline POS catalog (2026-10-01)

- Offline order snapshots now use a cached POS catalog only when its branch ID matches the authenticated branch and its product/table collections are present. An invalid cached catalog falls back only to a valid same-branch versioned realtime bootstrap.
- Regression test reproduced a different-branch product and variant leaking into the offline order snapshot; it now fails closed instead.
- Verification: Desktop tests 90/90, typecheck/lint, full monorepo CI, Windows Desktop 0.1.77 release and production tag passed. Dokploy completed without rebuilding server apps; production web smoke was skipped because no server service changed.
- This hardens offline display snapshots only; it does not replace server authorization or complete offline POS, cross-device reconciliation, printer hardware testing, or a 100% offline guarantee.
- Desktop bundle version: `0.1.77`.

## D2 amortized offline cache compaction (2026-10-01)

- Successful cached responses no longer trigger full per-scope SQLite compaction on every write. Cleanup runs on the first write for a scope, every 64 subsequent cache writes, or at least hourly when writes continue.
- Reads still reject entries older than the 30-day retention window immediately, even while physical cleanup is deferred; periodic cleanup remains scoped to the active authorization identity.
- Added regression coverage that verifies stale snapshots fail closed before compaction and expired rows are removed at the next scheduled batch.
- Verification: Desktop tests 91/91, typecheck/lint and full monorepo CI with 33/33 validators passed. Windows Desktop 0.1.78 was published; the production tag advanced. Dokploy completed without rebuilding server apps and web smoke was skipped because no server service changed.
- This reduces repeated SQLite cleanup work on read-heavy/online refresh paths; it does not guarantee zero UI stalls on every device or complete the outstanding multi-terminal/offline and physical printer acceptance.
- Desktop bundle version: 0.1.78.

## D2 realtime refresh checkpoint (2026-10-01)

- Realtime catch-up no longer persists its event cursor while pages are being read. It waits for the subscribed panel refresh to complete, then persists the cursor; a failed, cancelled or deliberately deferred refresh keeps the previous checkpoint so the events are retried.
- The contract now covers POS, payment queue, kitchen, waiter floor/detail, courier, online-order/admin order lists and order detail. Waiter actions, overlapping loads and API failures explicitly defer cursor advancement.
- The shared resource loader now has an awaited refresh path that reports success or failure for realtime checkpoint decisions without changing existing manual reload behavior.
- Added regression tests proving persistence waits for refresh completion and is skipped when refresh is deferred or fails.
- Verification: POS tests 16/16, typecheck and lint passed; full monorepo CI, Desktop 0.1.79 release, Dokploy deployment and production smoke passed in PR #171. The grouped waiter snapshot is delivered separately in the following D2 checkpoint.
- The checkpoint prevents losing events before a screen refresh; it does not make all cached screens atomic snapshots or prove restaurant-device offline operation. Separate offline snapshot and hardware outage acceptance remain open.

## D2 atomic waiter floor and order snapshot (2026-10-01)

- The authenticated realtime/bootstrap response now provides halls, active tables and their active orders/items from one repeatable-read snapshot to authorized waiter/table roles. POS-only sessions retain a lightweight table catalog without fetching waiter order details.
- Menu, payment-method, floor and order reads are permission-gated at the database query as well as at response serialization. Shared legacy menu data remains fail-closed when multiple active tenants make its ownership ambiguous.
- The Desktop waiter screen validates and loads its menu/floor from this single branch-bound snapshot; empty but valid floors are supported. A table detail request can be reconstructed from the same snapshot during an outage, and offline table-order creation requires a cached table belonging to the authenticated branch.
- Gateway integration coverage uses only the grouped bootstrap cache for offline waiter order creation and detail reads, and rejects a deliberately cross-branch snapshot. Verification so far: backend 489/489 tests plus the focused bootstrap checks, Desktop 92/92 tests, POS 20/20 tests, and backend/Desktop/POS typechecks passed. Full monorepo CI, Windows Desktop 0.1.80 release, Dokploy deployment and production smoke passed in PR #172.
- Desktop bundle version: 0.1.80.
- This is a stronger cached-read and waiter-order slice, not a 100% offline guarantee. First-time setup/login, uncached data, card payments, unsupported/admin operations and some cross-device changes still need internet. Power-loss and restaurant hardware/printer acceptance must still be performed at the restaurant.

## D2 visible staff refresh state (2026-10-01)

- Staff panel refresh state is now visible while requests are in progress, including when cached data remains on screen; stale-cache refreshes are distinguished from fresh-cache refreshes.
- This is operator feedback, not a freshness guarantee. Offline writes still depend on each command's authorization, cached data and idempotency contract.
- Verification: focused offline-freshness tests 9/9 and full monorepo CI passed. Windows release, Dokploy deployment and production smoke passed in PR #173.
- Desktop bundle version: 0.1.81.

## D2 offline kitchen queue snapshot (2026-10-01)

- The Desktop kitchen panel now loads its active queue from a branch-bound, repeatable-read bootstrap snapshot. The response is capped at 250 tickets and selects only kitchen display fields; customer phone and address fields are not requested.
- The browser-based kitchen panel keeps using the existing `/kitchen/orders` endpoint. The Desktop path validates snapshot version, timestamp, queue shape and each ticket's branch before rendering.
- Verification: backend bootstrap tests 3/3, POS snapshot tests 2/2, focused typecheck/lint passed, and full monorepo CI passed (including all 33 operations validators).
- Desktop bundle version: 0.1.82. PR #175 main CI 36845068251, Windows release 36845068298, and Dokploy deployment 36845440710 completed successfully; production smoke passed.
- This improves cached reads only. Offline kitchen actions still depend on their existing idempotency/replay rules; uncached data, expired sessions and unsupported operations are not made available offline by this change.


## D3 courier offline status safety (2026-10-01)

- PR #176 was merged as 17b79672. The Desktop gateway now requires a same-branch cached courier order and exact expected version before queueing status changes, projects pending status locally, rebases sequential commands after each server acknowledgement, and reconciles the active courier cache transactionally.
- Offline completion is blocked when the cached outstanding balance is positive or unknown, or when payment/shift fields cannot be safely recorded. This prevents marking an unpaid delivery complete without updating the courier shift.
- Desktop test suite passed 95/95; typecheck, lint and preload build passed. PR CI 36851591256 and main CI 36851965498 passed. Desktop 0.1.83 release 36851965457 succeeded. Dokploy workflow 36852315907 succeeded; production smoke was correctly skipped because this checkpoint changed no server service.
- This is a bounded offline command path, not a guarantee that all courier work, login, electronic payments or uncached data work without connectivity.

## D4 desktop realtime socket signal (2026-10-01)

- Desktop staff panels currently rely on a five-second catch-up poll because the local HTTP gateway does not proxy Socket.IO upgrades. The D4 change opens an authenticated WebSocket directly to the configured Mazetto API origin, uses realtime events as low-latency catch-up triggers, and retains cursor-based catch-up polling at a slower interval while connected and a five-second fallback while disconnected.
- Event-triggered catch-up requests are coalesced so an arriving signal during an active sync gets one follow-up pass without making the outage fallback spin.
- Verification: Desktop tests 97/97, typecheck/lint/preload build passed; POS tests 23/23, typecheck/lint and production build passed. PR CI 36854063208 and main CI 36854559249 passed; Desktop 0.1.84 release 36854559278 completed; Dokploy deploy 36854914031 and production smoke passed.
- The production smoke confirms the deployed services responded, but an authenticated socket session from each restaurant's real Desktop client and reconnect under an actual network outage remain field acceptance checks.

## D5 printer test-run isolation (2026-10-01)

- Testing selected Windows printer queues now continues after an individual printer fails and reports each queue result separately. The summary says Windows accepted the print request; staff still need to confirm the paper physically came out.
- Mazetto imposes no fixed count limit on selected Windows-installed queues. USB, Bluetooth and network printers work through their installed Windows drivers; direct driverless network printing is limited to compatible ESC/POS TCP devices. There is no honest guarantee for every printer model without driver/protocol and physical-device testing.
- Verification: POS tests 25/25, typecheck/lint and production build (49 routes) passed locally. PR CI 36858783551 and main CI 36859230064 passed; Desktop 0.1.85 release 36859230045 published `desktop-v0.1.85`; Dokploy deploy 36859610772 and production smoke passed.
- This is a reliability improvement to the existing configuration screen, not completion of D5's end-to-end durability gates. Power-loss, lease expiry, real printer failure/restart, and duplicate-prevention acceptance still need branch hardware tests.

## D6 offline kitchen mutation cache/version gate (2026-10-01)

- Before returning an offline queued response for a kitchen action, Desktop now requires a cached kitchen ticket from the active branch and an exact expected version. Missing version/cache/ticket, cross-branch data and stale versions are rejected without creating an outbox command.
- Valid sequential kitchen actions remain optimistically projected and are rebased on server acknowledgements during replay.
- Verification: Desktop tests 98/98, typecheck and scoped lint passed. PR CI 36861661935 and main CI 36862128678 passed; Desktop 0.1.86 release 36862128424 succeeded; Dokploy deploy 36862537591 succeeded. Production smoke was skipped because this change modified no server services.
- This closes one unsafe queue path; it does not make unsupported admin/configuration writes, first-time login, uncached data, card payments or every role fully offline.

## D6 waiter order version gate (2026-10-01)

- Offline waiter supplemental item additions require the order to exist in the current branch's cached bootstrap and the request's expected version to match its optimistically projected version. Sequential additions build on prior queued additions. Item edits and cancellations remain online-only until their local projections are implemented.
- Missing/stale versions, missing orders/items and cross-branch snapshots fail closed without adding an outbox command.
- Verification: Desktop tests 100/100, typecheck and scoped ESLint passed. PR #180 merged to main as dae3a1b; Windows Desktop 0.1.87 was published and Dokploy deploy succeeded. Production smoke was skipped because the change modified no server services.
- Desktop bundle version: 0.1.87.


## D7 Desktop cold-start cache cleanup (2026-10-01)

- Desktop no longer scans and compacts every cached user scope synchronously during startup. Cache entries are still freshness-checked on reads; the existing bounded compaction runs when that scope is next written. This avoids doing unrelated cleanup work before the staff UI can open.
- Verification: Desktop tests 101/101, TypeScript, scoped ESLint and diff checks passed. PR #181 merged as 74a23ad; Windows Desktop 0.1.88 installer assets published, Dokploy deploy succeeded, and production smoke was skipped because no server service changed.
- Desktop bundle version: 0.1.88.


## D6 waiter item quantity and note edits (2026-10-01)

- Offline waiter edits may change an existing active line's integer quantity (1-99) and/or note only when the order and line are in the authenticated branch snapshot and the expected order version exactly matches the optimistic cache. Modifiers, cancellation, terminal orders, malformed pricing snapshots and stale versions remain online-only/fail-closed.
- The local table cache projects line and order totals and versions; edits on one order replay in order and are rebased from each server acknowledgement. Waiter PATCH calls now carry stable idempotency keys.
- Verification: pending focused tests, typecheck, lint, full CI, Windows 0.1.89 release and Dokploy deploy.
- Desktop bundle version: 0.1.89.
