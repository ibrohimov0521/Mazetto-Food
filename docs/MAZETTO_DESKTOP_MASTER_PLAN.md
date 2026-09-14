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
schema. It intentionally caches only successful JSON GET responses. Mutations
still require the upstream API until D3 command contracts are implemented.
The shell also contains the safe update lifecycle, but it remains inactive
until an HTTPS feed is provisioned.
This gives us a runnable base without introducing unsafe pseudo-offline writes.
