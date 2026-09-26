# BestTeam Owner Console

`admin.mazetto.uz` is the owner-only central control panel; `mazetto.uz` is a public, no-login demo that must not persist visitor data. `mazettofood.uz` remains one restaurant's domain. Each restaurant keeps its own branded customer/admin apps, domains, Telegram bot, and groups, while the restaurant services share one backend and PostgreSQL database. The current `PlatformSite` registry is monitoring metadata only: tenant provisioning, tenant data isolation, and demo isolation are not implemented yet.

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
- The owner UI and monitoring API use the existing shared Mazetto backend and database. Central owner identity is separated by the `PLATFORM_OWNER` role; this role split is not a substitute for tenant isolation of restaurant data, which remains a release blocker.
- The monitoring module is loaded by the normal Mazetto API; there is no second platform backend or platform database. Its owner routes require `PLATFORM_OWNER`, and the restaurant backend's production environment/configuration remains the source of truth.
- Heartbeats contain operational counts and daily aggregates for completed/cancelled orders, not customer names, phones, addresses, payment details, or item-level/order-level records. The central report is explicitly a gross completed-order total and does not subtract refunds.
- The browser does not call restaurant backends directly. The central backend checks public HTTPS endpoints and receives authenticated agent heartbeats.
- The public central `/health` endpoint checks database connectivity and reports whether Redis is connected or the safe in-memory fallback is active. Point an independent external uptime monitor at this endpoint to detect when the central service itself is unreachable; an in-panel monitor cannot report its own host being offline.
- The console is `noindex`, and TLS plus restricted owner account access are required before public deployment.

## Delivery Phases

1. **Owner console foundation (implemented in this branch, not deployed):** separate owner frontend on the shared API, owner login, monitoring registry/detail, agent token rotation, event/diagnostic feeds, audited acknowledgement, audit history, and operational summaries. Isolated API and browser integration QA pass. Adding a monitoring record does not yet create a tenant or provision its apps.
2. **Operations (in progress):** safe diagnostics telemetry, 30-day retention, and backup evidence are present. Still needed: restore drills, approved dry-run cleanup, redacted application logs, incident timelines, and independent uptime/alert delivery. A listed backup is not proof of a successful restore.
3. **Tenant platform (not implemented):** tenant/domain models, verified host-to-tenant routing, backfill of Mazetto branches, per-tenant authorization across every API, lifecycle/suspension controls, and provisioned restaurant apps/bots. The demo must be isolated and non-persistent. Other BestTeam products are out of scope for this release.

## Release Gate

Do not deploy or onboard another restaurant until tenant isolation and the non-persistent demo are implemented and tested against a production-sized copy. Then take and restore-test a backup, apply migrations in staging, backfill Mazetto as the first tenant, verify cross-tenant denial, and roll out behind a reversible Dokploy release. Later route `admin.mazetto.uz` to this owner UI and `mazetto.uz` to the isolated demo; Cloudflare/DNS work is intentionally pending.

Create the central identity through `apps/backend/scripts/bootstrap-platform-owner.ts` with the normal shared `DATABASE_URL`, `BESTTEAM_OWNER_BOOTSTRAP=1`, `BESTTEAM_OWNER_EMAIL`, and a strong `BESTTEAM_OWNER_PASSWORD`. It creates only the `PLATFORM_OWNER` role and `SYSTEM_HEALTH_VIEW` permission. It does not reset an existing owner's password; a conflicting non-owner account is rejected. Keep credentials out of checked-in files and shell history.

`apps/backend` runs the shared API with its normal `DATABASE_URL`, JWT secrets, and Redis. The owner web app's `BESTTEAM_API_INTERNAL_URL` must point to that same API service. Tenant-specific host resolution and data authorization must be completed before routing any additional restaurant domains to it.

Build the normal `apps/backend/Dockerfile` runner for the shared API and `apps/platform-web/Dockerfile` for the owner UI, configured to proxy to that API. No production Dokploy project/service or public domain has been changed by this work.

## Development Check

`apps/platform-web` is a distinct owner-only frontend (development port `3104`) whose proxy targets the shared API through `BESTTEAM_API_INTERNAL_URL`. Layout mocks are not a live integration test.

Monitoring migrations in this branch have not been applied to production. The production Mazetto service and database remain unchanged. This shared database is the target architecture, but it is not yet safe for multiple restaurant tenants without the isolation gate above.

`apps/backend/scripts/qa-platform-isolated.mjs` creates a random temporary database in the localhost `mazetto-dev-postgres` container, applies migrations, bootstraps a throwaway owner, starts the normal shared API and owner web app, and exercises role isolation, monitoring, reports, diagnostics, events, acknowledgement, audit, and browser onboarding. It drops only its temporary database. This end-to-end QA passed after the health response was aligned to the common API envelope.
