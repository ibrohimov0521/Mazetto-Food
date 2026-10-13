# MAZETTO FOOD remediation plan

This is the ordered backlog produced by the 2026-09-21 product audit. Complete
one gate at a time. `P0` blocks safe release, `P1` blocks a core workflow, `P2`
is important completeness/security, and `P3` is improvement or cleanup.

## Execution order

### Gate A - data and release safety

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-101 | P0 | Production DB migration history is not reconciled with the restored schema; generic migration caused an outage | Create verified backup; restore into isolated DB; baseline `_prisma_migrations`; run all migrations twice; deploy and rollback rehearsal; document checksums |
| AUD-102 | P1 | No single release acceptance suite covers customer, staff, Desktop, Telegram and printing | Add read-only smoke plus disposable isolated write E2E; production human checklist records actor/time/result without fake live orders |
| AUD-103 | P2 | Historical status document mixes deployed, local-only and obsolete claims | Keep this audit directory current and archive/supersede stale status sections |

### Gate B - receipts and printing

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-110 | P1 | `Receipt` is unique by `orderId`, but cancellation code tries to create a second document | Model append-only sale/cancellation/refund documents; migrate data; test paid order then cancellation and repeated cancellation idempotency |
| AUD-111 | P1 | Desktop claims a job before confirming a usable printer; untargeted jobs can be exhausted with no printer | Claim only declared ready printer IDs/routes; leave unprintable jobs pending with `WAITING_FOR_PRINTER`; test no-printer state causes zero attempts |
| AUD-112 | P1 | Printer page exists but is absent from sidebar | Add Printers after Receipts with `RECEIPT_PRINT`; route/nav/access validator must fail on future drift |
| AUD-113 | P1 | Printer records cannot be deleted and deactivation workflow is incomplete | Add audited deactivate/delete with reference safety; expose in Admin; test active jobs cannot lose target silently |
| AUD-114 | P1 | Desktop UI supports one fallback host/port while product requires multiple printers | Add discovery/manual multiple printers, roles, readiness, per-printer test and branch assignment |
| AUD-115 | P1 | Receipt queue shows server errors without an operator-safe recovery explanation | Normalize error responses, job state labels, retry/reassign controls and dead-letter reason; test stale lease recovery |
| AUD-116 | P2 | Standalone print-agent and Desktop overlap; print-agent defaults to dry run | Make Desktop canonical and deprecate/remove agent, or define exclusive deployment ownership and health |
| AUD-117 | P1 | User reports a printer now prints correctly, but exact model/media/interface and mixed-printer acceptance are not recorded | Record device and connection; test 58/80mm ESC/POS, Uzbek text, long items, cut, duplicate prevention, offline recovery, cancellation, reprint, and mixed routes on the actual hardware |
| AUD-118 | P1 | Receipt details previously showed mutable live order data instead of the immutable `Receipt.content` snapshot | Snapshot schema v1 is now written and detail prefers saved order/items/modifiers/notes/payments; automated tests cover edits, empty refund items, and legacy fallback; retain physical reprint verification |
| AUD-119 | P2 | Receipt status can misrepresent one of several printer outcomes | Summarize the latest enqueue batch across all targeted printers; surface mixed/failing outcomes, distinguish driver acceptance from physical paper, and test stale earlier reprints |

### Gate C - Desktop identity and offline completeness

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-120 | P1 | Kitchen actions are PATCH in backend but Desktop registry allows POST only | Generate/validate registry from route contract; offline accept/start/ready/complete/cancel each replay once |
| AUD-121 | P1 | Item cancel and cash transfer accept/reject paths do not match Desktop registry | Add exact typed commands and tests for nested action routes |
| AUD-122 | P1 | Device guard validates only when client supplies `x-mazetto-device-id` | Enrollment issues a revocable device credential bound to device and branch; protected Desktop endpoints require it |
| AUD-123 | P2 | Remembered Desktop login uses bundled browser storage, not OS credential protection | Store refresh secret with Windows secure credential mechanism; migrate/logout safely |
| AUD-124 | P2 | No complete support bundle for branch troubleshooting | Export redacted version/device/connectivity/outbox/conflict/print diagnostics without tokens/customer secrets |
| AUD-125 | P2 | Offline coverage is manually maintained and can drift again | Contract test every mutating staff route, explicitly classify online-only vs queueable, and fail CI on mismatch |

### Gate D - money, inventory and business correctness

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-130 | P1 | Click/Payme/Card providers, callbacks and reconciliation are absent | Implement provider-signed initiation/callback/idempotency, payment state, reconciliation and failure UX before enabling method |
| AUD-131 | P1 | Cash refund is implemented; external provider refund/reconciliation remains disabled | Keep cash refund permissioned and idempotent with immutable reversal, cash ledger, refund receipt and audit/report treatment; add signed Click/Payme/Card provider refund only after provider contracts and reconciliation are available |
| AUD-132 | P2 | Ingredient and warehouse master data lacks edit/deactivate lifecycle | Add branch-safe update/archive with reference protection and history |
| AUD-133 | P2 | Automatic recipe deduction fails if no active warehouse exists | Add readiness check/dashboard and prevent enabling recipe deduction until warehouse mapping is valid |
| AUD-134 | P2 | Modifier lifecycle has create/update but no explicit archive/delete action | Define archive policy, expose action and preserve historical orders |
| AUD-135 | P2 | Some human-readable ticket/order/receipt identifiers use bounded random allocation | Add database-backed sequence or robust retry for every unique identifier; concurrency test collisions |

### Gate E - navigation, permissions and security

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-140 | P1 | Admin route access and sidebar previously disagreed for custom roles | Permission-first access is now used consistently for `/admin` routes and sidebar items; built-in `roles` remain descriptive metadata, with custom-role regression coverage |
| AUD-141 | P2 | Customer refresh session migration needed to remove browser storage dependency | Customer-web now restores/rotates the Secure HttpOnly SameSite cookie and only keeps short-lived access/profile data locally; production cookie/CORS/CSRF acceptance remains |
| AUD-142 | P2 | Homepage image upload requires `MENU_EDIT`, blocking a homepage-only custom role | Add purpose-aware upload permission and strict folder mapping; test homepage manager without menu edit |
| AUD-143 | P2 | Navigation validation checks listed links but not reachable pages omitted accidentally | Maintain route manifest with `sidebar`, `child`, `workspace` or `hidden` intent; CI verifies all pages |
| AUD-144 | P3 | Kitchen seeded role includes shift/cash permissions that may violate responsibility separation | Confirm business policy; remove permissions unless kitchen staff owns cash operations |

### Gate F - realtime, Telegram and operations

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-150 | P2 | Customer order hook refreshes broadly on realtime events and also polls every 15 seconds | Scope events to customer/order, back off polling while socket healthy, load-test fan-out |
| AUD-151 | P2 | Telegram code is split between monitoring agent and backend business handler with implicit ownership | Document backend as update handler and agent as webhook controller/health monitor; enforce one webhook owner |
| AUD-152 | P2 | Telegram staff group flow lacks current human acceptance evidence | Test one legitimate lifecycle with group buttons, customer updates, retry and no duplicate messages |
| AUD-153 | P2 | Health/audit/dead letters exist without centralized alert ownership | Define SLOs and alerts for API/DB, Telegram errors, print dead letters, offline device and queue age |
| AUD-154 | P2 | External geocoding and object storage dependency failures are not represented in one readiness view | Add dependency probes with safe timeout and degraded status, without leaking credentials |
| AUD-155 | P3 | CORS is code-correct but runtime origin configuration can drift | Expose redacted configured-origin check in deployment validation and test HTTP plus Socket.IO |

### Gate G - product completeness and QA

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-160 | P2 | Authenticated browser matrix was missing | Initial Playwright matrix covers SUPER_ADMIN, ADMIN, manager, accountant, cashier, waiter, kitchen and courier at 1440px/390px with mocked APIs, overflow checks and page-error assertions; customer and workflow-specific persistence/keyboard journeys remain open |
| AUD-161 | P2 | Full isolated order lifecycle acceptance was missing | Disposable 61-migration DB E2E now exercises customer WEB/TELEGRAM and POS order/payment/stock/receipt/print paths, including idempotency and recovery; actual printer output and full browser transaction flows remain separate gates |
| AUD-162 | P3 | Customer web is not installable/offline | Decided online-only: browsing may use its short in-memory cache, but checkout blocks offline submission with a visible reason and never queues an order locally |
| AUD-163 | P3 | Courier flow has status/assignment but no routing optimization/proof-of-delivery | Add only after core accounting/printing gates; define photo/signature/privacy retention first |

### Gate H - restaurant order workflow controls (2026-10-13 request)

Implementation work for these six requirements is in the current audit branch;
completion is not certified until each acceptance gate below passes. Report
each ID separately in the release summary.

| ID | Priority | Requirement | Acceptance test / remaining gate |
| --- | --- | --- | --- |
| AUD-164 | P2 | Show order types in Uzbek, not internal English enum names | Verify Zal, Olib ketish, and Yetkazib berish in staff history, kitchen history, Desktop/offline receipts, and Telegram; no raw `DINE_IN` in user-facing output |
| AUD-165 | P1 | Let an operator enable/disable POS-created orders in Kitchen; by default only online WEB/TELEGRAM orders are shown and managed, while kitchen-designated items still print | Toggle in System Settings; verify all POS orders (cashier and waiter table) are hidden by default while WEB/TELEGRAM orders stay visible; enabling includes POS; test list/history/detail, alerts, direct ticket reads/actions with known IDs, transaction recheck, and unchanged kitchen printing |
| AUD-166 | P1 | Handoff recipient and cancellation note must be optional | Submit handoff and cancel with both fields blank from every supported UI/API path; verify status, audit/history text, and permissions remain correct |
| AUD-167 | P2 | Configure the first displayed order number in System Settings | Test start at 1 and 101, independent tenant/source/date sequences and locks, concurrent creation, web/Telegram/Desktop offline paths, restart, changing the start while a terminal is offline, lowering without reusing prior numbers, and a queued sale crossing Tashkent midnight. Preserve terminal-bound labels; derive legacy dates only from queuedAt and reject ambiguous records for reconciliation. Verify printed labels on two physical terminals |
| AUD-168 | P1 | Route products independently to kitchen, customer receipt only, or no printer | Confirm default route, product editor persistence, mixed-order receipt contents, kitchen suppression, Desktop offline parity, and that route policy is identical before USB, Windows-spooler, and network/IP printer transports; physically test configured printer outputs. Separate bar station remains out of scope |
| AUD-169 | P2 | Provide predictable keyboard operation for primary actions throughout staff workflows | Verify normal Tab/Shift+Tab focus and native Enter/Space activation, Enter submits login and confirms the intended POS/payment/refund/shift action, Escape closes dismissible dialogs and menus, and text entry/IME/repeated keys never trigger unintended actions; record browser checks per workflow |

Current evidence: automated backend/POS/Desktop tests, typecheck/lint, isolated
database order-to-cash-to-print E2E, migration checksums, and repository
validators pass on the audit branch. Offline order dates are now preserved when
a queued sale is replayed after Tashkent midnight; an old queued sale can derive
its date only from persisted queuedAt, otherwise it fails closed for operator
reconciliation. Browser acceptance for these six flows, live setting/offline
refresh acceptance, and physical mixed-printer acceptance remain pending;
production migration/deploy must follow the controlled release gate and
verified-backup procedure.


## Status of user-requested items (2026-10-13)

This is the current status for AUD-164 through AUD-169 and supersedes older
progress notes, especially the claim that waiter POS orders remain visible.
Kitchen now hides all POS-origin orders by default; WEB and TELEGRAM remain visible.

1. **AUD-164, Uzbek order types:** POS/Kitchen history, receipts and reprints,
   Desktop offline receipts, and Telegram use Uzbek labels. Unknown values use
   an Uzbek fallback. Automated tests pass; full rendered-screen crawl remains open.
2. **AUD-165, Kitchen visibility:** System Settings toggles inclusion of POS
   orders. Off hides cashier and waiter/table POS orders from queue, history,
   detail, actions, and Desktop projections. WEB/TELEGRAM remain visible and
   kitchen print routing is unchanged. Backend tests pass; live persistence and
   offline cache-refresh acceptance remain open.
3. **AUD-166, optional handoff/cancel text:** Recipient name and operator note
   are optional; the workflow still records its audit reason code. API tests
   pass; blank-field live UI acceptance across roles remains open.
4. **AUD-167, starting number:** Setting supports 1 (default 101), with tenant,
   source, and Tashkent-date isolation. Migration and concurrency tests pass; a
   two-terminal offline test asserts distinct provisional labels and replay-once.
   Registered terminal ID is embedded and backend-validated; unregistered devices
   cannot sell offline. A server start change from 1 to 101 does not invalidate
   a previously printed terminal-bound label; a late replay also keeps its
   original Tashkent date. Legacy commands derive dates from stored queuedAt;
   commands without trustworthy date metadata fail closed for reconciliation. Physical
   printer and live workstation verification remain.
5. **AUD-168, printer routing:** Product default is Kitchen; alternatives are
   customer receipt only or no print. Backend/Desktop mixed-order and offline
   tests pass, with routing selected before the configured printer transport.
   USB, Windows-spooler, and LAN/IP physical printer behavior, plus live
   persistence, remain open acceptance tests.
6. **AUD-169, keyboard:** Native button/form activation, guarded Enter, Escape,
   and modal focus handling are implemented and tested. Real workstation login,
   payment/refund, shift-close, and focus acceptance remains open; unsafe actions
   are not globally triggered by Enter.

The full automated pnpm release acceptance passed on 2026-10-13, including all
app checks, validators, replay of 61 migrations in a disposable database, seed,
and order-to-cash-to-stock-to-print E2E. Browser/device acceptance and production
deployment remain separate gates; no production database, push, or deploy changed.
## Definition of done for every item

1. Business behavior and permissions are written before implementation.
2. API, UI, Desktop/offline and audit effects are covered together where relevant.
3. Automated tests reproduce the defect before the fix and prevent regression.
4. Typecheck, lint, tests, build and repository validators pass.
5. Database changes are rehearsed against a restored backup.
6. Deployment health passes and the exact human smoke result is recorded.
7. Documentation and operator recovery steps are updated in the same change.

## Current execution point (2026-10-13)

The original implementation-first sequence below has been superseded by the
completed audit work and the release gates recorded here. Do not restart those
completed batches or treat automated acceptance as production approval.

1. The current candidate is PR #296, head `b064d8e034b851b6d58f9b1b3a9d43a7d0a51773`.
   Required GitHub checks `verify` and `windows-desktop-package` passed.
2. The deployed staging API is still `f6531fc` from 2026-10-04. The live
   staging A/B proof passed on that older image, not on this candidate.
3. Before production, take and verify a fresh staging-only backup, deploy this
   exact candidate to staging, apply its two pending migrations
   (`20261013120000_product_kitchen_printer_routing` and
   `20261013140000_tenant_scoped_order_numbers`) with `prisma migrate deploy`,
   then verify migration status, API/PostgreSQL/Redis health, staging A/B, and
   Mazetto Food order-to-kitchen/cash/receipt regression. Keep all fixtures
   synthetic; do not send real Telegram/SMS or payment side effects.
4. Only after candidate-specific staging and rollback/restore gates pass may the
   approved production release procedure be considered. Production currently
   remains at 59 migrations; the candidate has 61. Keep second-restaurant
   activation disabled.
5. Record the six restaurant workflow items AUD-164 through AUD-169 separately.
   Their automated checks pass, but live workstation/settings refresh and
   physical mixed-printer checks remain acceptance gates.
6. The PR description still contains stale migration and test-count claims; fix
   those before review/merge so the release record matches the candidate.

### Historical implementation-first sequence

Start with `AUD-101`, then `AUD-110` through `AUD-115`, then `AUD-120` through
`AUD-122`. This order protects data first, makes receipts/printing truthful, and
only then expands offline operation. Payment providers and wider feature work
must wait until those foundations pass their acceptance tests.
## UI settings save/reload matrix (2026-10-13)

- Extended the admin-settings browser check to save order-number start 1 and the Kitchen POS visibility toggle, reload the page, and assert both values persist in the UI.
- The current branch passed Playwright at 1600, 768, 360, and 320px widths.
- The script uses an isolated mocked API; this verifies the UI request and reload state, not production tenant persistence or Desktop offline-cache propagation.
- Keep actual tenant/database, permission, offline refresh, workstation, and physical-printer acceptance gates open.

## Immediate setting cache isolation check (2026-10-13)

- Added a two-tenant regression test proving Kitchen visibility and order-number settings read current database values instead of stale Redis entries.
- Targeted setting test, backend lint/typecheck, and the four-width mocked UI save/reload matrix pass. Real tenant database writes and Desktop offline refresh remain open acceptance gates.

Latest verification: backend suite 719/719 and transient-HTTP retry suite 3/3
pass after the settings-cache regression was added. This remains audit-branch
evidence only; production changes have not been made.

## Production migration audit (read-only, 2026-10-13)

- Production has 59 completed migrations, with no failed, unfinished, or rolled-back rows. All 59 checksums match local migration files; there are no production-only migrations.
- The audit branch has 61 migrations. Only 20261013120000_product_kitchen_printer_routing and 20261013140000_tenant_scoped_order_numbers are pending in production.
- Read-only migration preconditions found zero orders without a branch tenant and zero duplicate tenant/source/date/display-sequence tuples. Existing printer routes are KITCHEN: 74 and NONE: 4; all four NONE products are beverages.
- Removed the pending printer migration's blanket NONE-to-KITCHEN update. New products still default to KITCHEN, while existing per-product choices are preserved.
- A fresh verified production backup was restored to an isolated PostgreSQL 18 database; all 61 migrations applied twice, order/product counts and printer-route distribution were preserved, and the independent rollback restore matched.
- Full automated release acceptance passed. No production migration, production write, push, or deploy was performed; real printer and workstation acceptance remain open.
