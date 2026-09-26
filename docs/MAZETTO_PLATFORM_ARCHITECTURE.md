# Mazetto Multi-Restaurant Platform

## Product Boundaries

- `admin.mazetto.uz`: private owner console for the platform operator. It can monitor all tenants and, after provisioning is implemented, manage tenant lifecycle and configuration.
- `mazetto.uz`: public demo with no account and no durable writes. Demo data must be isolated from real restaurant records and resettable.
- `mazettofood.uz`: one restaurant's customer-facing domain, not the platform domain.
- Every restaurant keeps its own branded public/admin web apps, domains, Telegram bot identity, and Telegram groups. These apps use one shared restaurant API and one shared PostgreSQL database.
- Restaurant `SUPER_ADMIN` is scoped to its own tenant. `PLATFORM_OWNER` is a separate central role and must not inherit restaurant permissions by accident.

## Target Request Flow

1. A trusted request hostname is resolved against a verified domain record to one active tenant. The client cannot choose or override the tenant by sending an arbitrary ID.
2. The shared API authenticates the user and checks membership/permissions for that tenant before reading or changing restaurant data.
3. Branches belong to one tenant. Business queries must be tenant-scoped directly or through a verified branch relation; globally unique constraints are reviewed and made tenant-aware where appropriate.
4. Cache keys, idempotency scopes, realtime events, file paths, background jobs, bot credentials, reports, and audit records all carry tenant scope. Cross-tenant attempts are denied and audited.
5. Owner-only platform records and tenant business records remain distinct even though they share a database. Database roles, composite foreign keys, and row-level controls should provide defense in depth where they fit the current Prisma access patterns.

## Current State

- The owner frontend exists at `apps/platform-web`; owner monitoring routes are part of the regular Mazetto backend. The owner role is `PLATFORM_OWNER`, distinct from restaurant `SUPER_ADMIN`.
- Monitoring registry, heartbeat, diagnostics, event acknowledgement, audit feed, operational summaries, and health checks pass isolated API and browser QA.
- `RestaurantTenant` and `TenantDomain` are now separate from `PlatformSite`; an additive migration creates Mazetto Food as tenant one and assigns existing branches. The isolated QA checks tenant defaults and keeps new domains pending.
- Host-to-tenant routing, verified-domain workflows, tenant memberships, business-data authorization, lifecycle controls, and demo isolation are still not implemented. The Mazetto tenant default is transitional, not multi-tenant authorization.
- The public demo is not implemented as an isolated no-persistence experience.
- No production migration, Dokploy project/service change, or DNS/Cloudflare change has been made. Do not add another restaurant or expose more domains to the shared API until the isolation gate is met.

## Backfill Risks

- A read-only production snapshot on 2026-09-26 found two existing branches. The new additive migration assigns existing branches to Mazetto Food; confirm the row count on a restorable staging copy before any production migration.
- `User.email`/`User.phone` and `Customer.email`/`Customer.phone` are currently globally unique. Decide tenant-specific login and customer identity rules before changing those constraints.
- `Branch.code` and `Order.orderNumber` are globally unique today. Preserve receipt, Telegram, and API compatibility when making identifiers tenant-aware.
- Several records have nullable branch references, including catalog, pricing, suppliers, payment methods, and Telegram checkout sessions. Assign ownership explicitly; never infer a tenant from an arbitrary first branch.
- Customer addresses, sessions, carts, favorites, and verification challenges need tenant-aware access even when they do not carry a direct `branchId`.
- Idempotency, realtime delivery, background work, and audit trails must also be tenant-scoped; adding `tenantId` only to `Branch` does not provide isolation.


## Ordered Delivery

1. Confirm and test an off-site backup restore; inventory all tables, branchless records, global uniqueness, external integrations, and live API entry points.
2. Tenant/domain schema and Mazetto-first branch assignment are now implemented in this branch. Next add tenant membership/auth context and domain verification; keep new tenant creation disabled until authorization is complete.
3. Enforce tenant scope across every HTTP route, WebSocket, scheduled job, queue, bot, cache, upload, export, and nested relation. Add two-tenant adversarial tests before enabling a second tenant.
4. Add owner lifecycle controls: create tenant, assign domains/apps/integration secrets, pause/resume safely, inspect status/log summaries, and audit every owner action. Monitoring registration alone must not be presented as full provisioning.
5. Build the demo as a separate read-only/ephemeral experience using sanitized fixtures; verify no real API write, login, customer data, or durable browser/server storage can occur.
6. Run migrations and full regression tests on a restorable staging copy. Backfill Mazetto as tenant one, verify existing orders/POS/customer flows, then test tenant two isolation.
7. Only after explicit release approval, configure Dokploy and domains in stages with health checks and a tested rollback. DNS/Cloudflare work is a later, separate step.

## Dokploy Shape

- Keep the existing Mazetto PostgreSQL and backend as the single canonical database/API. Never create one copy per restaurant.
- Deploy `apps/platform-web` as the owner-only UI and proxy it to the same backend. Any separate Dokploy project must have an explicit private overlay-network path to that backend; otherwise keep the UI in the existing project.
- Deploy `mazetto.uz` as a distinct demo app with isolated fixtures and no persistent writes.
- Each tenant's branded web apps and Telegram credentials are separate deployments/configuration, but connect to the shared API after tenant routing and authorization are proven.
- Dokploy API access is now stored on the server and read-only verified. Inventory found nine projects, including `MAZETTO FOOD`; its production environment and existing services were inspected, but no Dokploy object or production service was changed.
