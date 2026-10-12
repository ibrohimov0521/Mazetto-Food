# BestTeam Owner Console

> Current status (2026-10-12): The BestTeam owner UI/monitoring is deployed at `admin.mazetto.uz`; the requested primary domain is `mazetto.uz`. Tenant hardening is being audited in PR #296, which is open and not deployed; routing `mazetto.uz` to this UI is a separate pending domain change not included in that PR. Keep the current route working until the root-domain route is staged and verified. New tenant activation remains blocked on staging A/B isolation, backup/restore evidence, and operational acceptance. Older notes about a public no-persistence demo are not part of the current requested scope.

`mazetto.uz` is the intended BestTeam multi-restaurant owner/super-admin panel. `admin.mazetto.uz` is the currently deployed owner-panel hostname and must remain available until a verified root-domain route and rollback are ready. `mazettofood.uz` and its apps are one restaurant's separately branded system. Each restaurant keeps its own customer/admin apps, domains, Telegram bot, and groups while the restaurant services share one backend and PostgreSQL database. `PlatformSite` remains monitoring metadata; tenant identity/domain/membership are separate. The current audit branch implements trusted-host resolution and membership-scoped authorization, but it is not merged/deployed; full staging A/B acceptance is still required.

## Daily Workflow

1. Sign in with a central `PLATFORM_OWNER` account. Restaurant `SUPER_ADMIN` accounts must never grant central-owner access.
2. Review the overview: offline sites, unhealthy APIs, missing agents, kitchen queues, and last contact.
3. Search or filter the restaurant directory by project and status. Open a restaurant to inspect its website, API, backend/database/Redis, kitchens, devices, and event history.
4. Register a restaurant with its name, project code, public website, and health URL. Copy the one-time agent token into that restaurant's backend secrets. The token is never displayed again unless rotated.
5. Rotate a compromised token, correct endpoints, or temporarily suspend monitoring from the restaurant detail view. These actions require confirmation and are audited by the backend.

## Screen Map

- **Overview:** operational totals, restaurants needing attention, and recent cross-restaurant events; no customer or sales data.
- **Restaurants:** searchable, filterable registry with website, API, agent, queue, and last contact columns.
- **Restaurant detail:** service health, branch/kitchen activity, branch-filtered events, and monitoring settings.
- **Activity:** the latest events across all restaurants, filterable by restaurant and incident state. Actionable alerts can be acknowledged once; the owner identity and timestamp are stored, and a separate audit event records the action. Routine order events cannot be acknowledged.
- **Owner audit:** searchable, paginated history of restaurant creation and settings changes, token rotations, and alert acknowledgements, with the acting owner and timestamp.
- **Reports:** 7/14-day completed-order counts and gross completed-order totals by day and restaurant, with CSV export and stale-agent warnings. These are operational summaries, not accounting statements; refunds are not subtracted.
- **Diagnostics:** the restaurant detail includes service health, operational events with safe next-step guidance, a copyable sanitized summary, and backup evidence. The cross-restaurant technical error page shows a strict allowlist of agent/control-plane failures, filters by restaurant/severity, and retains entries for 30 days. It stores no raw messages, stack traces, request data, or customer details. A verified archive listing is not a restore test.
- **Sign-in:** central owner authentication. The UI and API require the separate `PLATFORM_OWNER` role and `SYSTEM_HEALTH_VIEW` permission.

## Boundaries

- The owner console calls the central API through same-origin `/api/v1` rewrites. `BESTTEAM_API_INTERNAL_URL` points to the central backend, not a restaurant backend.
- The rewrite is disabled in every environment when `BESTTEAM_API_INTERNAL_URL` is missing. The UI must fail closed instead of silently connecting to a local Mazetto API.
- The owner UI and monitoring API use the existing shared Mazetto backend and database. Central owner identity is separated by the `PLATFORM_OWNER` role. Tenant host/domain/membership enforcement is implemented in the current audit branch, but release remains blocked until staging A/B tests prove isolation across APIs, jobs, media, real-time events, bots, and reports.
- The monitoring module is loaded by the normal Mazetto API; there is no second platform backend or platform database. Its owner routes require `PLATFORM_OWNER`, and the restaurant backend's production environment/configuration remains the source of truth.
- Heartbeats contain operational counts and daily aggregates for completed/cancelled orders, not customer names, phones, addresses, payment details, or item-level/order-level records. The central report is explicitly a gross completed-order total and does not subtract refunds.
- The browser does not call restaurant backends directly. The central backend checks public HTTPS endpoints and receives authenticated agent heartbeats.
- The public central `/health` endpoint checks database connectivity and reports whether Redis is connected or the safe in-memory fallback is active. Point an independent external uptime monitor at this endpoint to detect when the central service itself is unreachable; an in-panel monitor cannot report its own host being offline.
- The console is `noindex`, and TLS plus restricted owner account access are required before public deployment.

## Delivery Phases

1. **Owner console foundation (deployed):** separate owner frontend on the shared API, owner login, monitoring registry/detail, agent token rotation, event/diagnostic feeds, audited acknowledgement, audit history, and operational summaries. Isolated API and browser integration QA pass. Adding a monitoring record does not create a tenant or provision its apps.
2. **Operations (in progress):** safe diagnostics telemetry, 30-day retention, and backup evidence are present. Still needed: restore drills, approved dry-run cleanup, redacted application logs, incident timelines, and independent uptime/alert delivery. A listed backup is not proof of a successful restore.
3. **Tenant security (implemented in the open audit branch, not released):** tenant/domain records, verified host-to-tenant routing, memberships, and scoped service authorization are present. Full staging A/B acceptance across HTTP, WebSocket, jobs, bots, media, reports, and backfill remains open. Tenant creation remains `PROVISIONING`; there is no activation route. Domain cutover to `mazetto.uz` is a separate staged routing task; keep `admin.mazetto.uz` working during the transition.

## Release Gate

Do not activate another restaurant until the tenant isolation code is merged, migrations/backfill are verified on a restorable staging copy, and A/B denial tests pass across every asynchronous and user-facing path. Rehearse restore and rollback. Keep the existing `admin.mazetto.uz` route live while staging the requested `mazetto.uz` owner-panel hostname; change DNS/Dokploy only through an approved, reversible release with health checks.

Create the central identity through `apps/backend/scripts/bootstrap-platform-owner.ts` with the normal shared `DATABASE_URL`, `BESTTEAM_OWNER_BOOTSTRAP=1`, `BESTTEAM_OWNER_EMAIL`, and a strong `BESTTEAM_OWNER_PASSWORD`. It creates only the `PLATFORM_OWNER` role and `SYSTEM_HEALTH_VIEW` permission. It does not reset an existing owner's password; a conflicting non-owner account is rejected. Keep credentials out of checked-in files and shell history.

`apps/backend` runs the shared API with its normal `DATABASE_URL`, JWT secrets, and Redis. The owner web app's `BESTTEAM_API_INTERNAL_URL` must point to that same API service. Tenant-specific host resolution and data authorization are present in the open audit branch; no additional restaurant domain may be activated until staging acceptance and release gates pass.

Build the normal `apps/backend/Dockerfile` runner for the shared API and `apps/platform-web/Dockerfile` for the owner UI, configured to proxy to that API. No production Dokploy project/service or public domain has been changed by this work.

## Development Check

`apps/platform-web` is a distinct owner-only frontend (development port `3104`) whose proxy targets the shared API through `BESTTEAM_API_INTERNAL_URL`. Layout mocks are not a live integration test.

PR #296 is still open and has no production deployment as of this checkpoint. This document's 2026-10-06 environment notes are historical; use `docs/MAZETTO_AUDIT_2026-10-10.md` for the current code/test checkpoint. Do not infer production tenant safety from the presence of tenant code in a branch.

`apps/backend/scripts/qa-platform-isolated.mjs` creates a random temporary database in the localhost `mazetto-dev-postgres` container, applies migrations, bootstraps a throwaway owner, starts the normal shared API and owner web app, and exercises role isolation, monitoring, reports, diagnostics, events, acknowledgement, audit, and browser onboarding. It drops only its temporary database. This end-to-end QA passed after the health response was aligned to the common API envelope.
