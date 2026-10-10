# MAZETTO FOOD Production Deployment Audit

Runtime configuration was rechecked against the current source on 2026-10-10.
This document records the environment variables consumed by the applications
and the production wiring requirements.

## Environment Inventory

### BACKEND

| Variable                         | Required               | Secret/Public | Runtime/Build-time     | Description                                                                                                                                                                                                |
| -------------------------------- | ---------------------- | ------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                       | Required in production | Public        | Runtime                | Enables production-only checks for required JWT secrets. Set to `production` in Dokploy.                                                                                                                   |
| `BACKEND_PORT`                   | Optional               | Public        | Runtime                | NestJS listen port. Defaults to `4000` when omitted.                                                                                                                                                       |
| `DATABASE_URL`                   | Required               | Secret        | Runtime and Prisma CLI | PostgreSQL connection string used by `PrismaService` and `prisma.config.ts`.                                                                                                                               |
| `JWT_ACCESS_SECRET`              | Required in production | Secret        | Runtime                | Secret used to sign JWT access tokens. Backend throws in production if missing.                                                                                                                            |
| `JWT_REFRESH_SECRET`             | Required in production | Secret        | Runtime                | Secret used to sign JWT refresh tokens. Backend throws in production if missing.                                                                                                                           |
| `JWT_ACCESS_EXPIRES_IN_SECONDS`  | Optional               | Public        | Runtime                | Access token lifetime in seconds. Defaults to `900`.                                                                                                                                                       |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Optional               | Public        | Runtime                | Refresh token lifetime in seconds. Defaults to `604800`.                                                                                                                                                   |
| `REDIS_URL`                      | Optional               | Secret        | Runtime                | Redis connection URL; takes precedence over `REDIS_PORT`. Redis backs settings/session/rate-limit caches with in-memory fallback on connection failure.                                                    |
| `REDIS_PORT`                     | Optional               | Public        | Runtime                | When `REDIS_URL` is absent, connects to `redis://127.0.0.1:<port>`.                                                                                                                                        |
| `CORS_ORIGINS`                   | Optional               | Public        | Runtime                | Comma-separated allowed origins shared by HTTP and WebSocket gateways. Credentials are enabled; `*` is rejected. Defaults include the production Mazetto Food web/POS origins and local development ports. |

### CUSTOMER-WEB

| Variable                   | Required                | Secret/Public | Runtime/Build-time             | Description                                                                                                                                        |
| -------------------------- | ----------------------- | ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Required for production | Public        | Build-time and browser runtime | Public backend API base URL used by customer-web fetch calls and Socket.IO base derivation. Production value: `https://api.mazettofood.uz/api/v1`. |

### POS-WEB

| Variable                   | Required                | Secret/Public | Runtime/Build-time             | Description                                                                                                                                        |
| -------------------------- | ----------------------- | ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Required for production | Public        | Build-time and browser runtime | Public backend API base URL used by POS auth/API fetch calls and Socket.IO base derivation. Production value: `https://api.mazettofood.uz/api/v1`. |

### POSTGRES

| Variable            | Required                                                  | Secret/Public | Runtime/Build-time     | Description                                                                                              |
| ------------------- | --------------------------------------------------------- | ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`     | Required only for local compose/Postgres service creation | Secret        | Service startup        | PostgreSQL bootstrap user used by `docker-compose.yml`.                                                  |
| `POSTGRES_PASSWORD` | Required only for local compose/Postgres service creation | Secret        | Service startup        | PostgreSQL bootstrap password used by `docker-compose.yml`.                                              |
| `POSTGRES_DB`       | Required only for local compose/Postgres service creation | Public        | Service startup        | PostgreSQL bootstrap database name used by `docker-compose.yml`.                                         |
| `DATABASE_URL`      | Required by backend                                       | Secret        | Runtime and Prisma CLI | Backend-facing PostgreSQL URL. In Dokploy, point this at the internal Postgres hostname, not Cloudflare. |

### REDIS

`RedisService` reads `REDIS_URL`, or `REDIS_PORT` when the URL is absent. It is
used for tenant settings cache invalidation and other short-lived caches and
limits. Redis is not the source of business data; callers have a fallback when
Redis is unavailable.

### TELEGRAM BOT

Telegram buyurtma va webhook mantiqi backenddagi `TelegramModule` ichida. `apps/telegram-bot` esa token va webhook secret bilan ishlaydigan customer/staff nazorat agenti: webhook holati, navbat va backend health'ni tekshiradi. Har ikki botning tokeni backend service'da, lekin agent servislariga ham o'zining mos token/secret env'lari berilishi kerak.

### PRINT SERVICE

The supported printer workflow is Mazetto Desktop with printers assigned in
the backend. `apps/print-agent` is a legacy fallback, disabled by default unless
`MAZETTO_LEGACY_PRINT_AGENT_ENABLED=true`; it also reads `MAZETTO_API_URL`,
`MAZETTO_PRINT_AGENT_TOKEN`, `MAZETTO_BRANCH_ID`, poll/health settings, and
optional raw-printer connection settings. Do not enable the legacy agent as a
second consumer for a printer already claimed by Desktop.

## Integrations Not Yet Environment-Backed

| Area                   | Current status                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis config           | `REDIS_URL` or `REDIS_PORT` is read by RedisService; Redis is optional and application data remains in PostgreSQL.                                                                                    |
| WebSocket config       | Kitchen WebSocket gateway uses the same `CORS_ORIGINS` allowlist as HTTP. Clients derive socket origin from `NEXT_PUBLIC_API_BASE_URL`.                                                               |
| CORS config            | HTTP CORS and the WebSocket gateway share `CORS_ORIGINS`; credentialed wildcard origin is rejected.                                                                                                   |
| Telegram bot config    | Backend TelegramModule bot webhooklarini qabul qiladi; alohida agent servislar token, webhook secret va API URL env'larini o'qiydi.                                                                   |
| Printer/receipt config | Mazetto Desktop uses printer assignments from the backend. The legacy print-agent reads its `MAZETTO_*` settings and is disabled by default.                                                     |
| Instagram integrations | No Instagram env is used.                                                                                                                                                                             |
| Payment integrations   | Cashier payment methods can be enabled per tenant for manual cashier confirmation; customer checkout remains CASH-only. No Click/Payme/bank provider callback or settlement credential is configured. |

## Dokploy Service Order

1. PostgreSQL
2. Redis, optional for short-lived caches and limits; application data remains in PostgreSQL
3. Backend API
4. Customer web
5. POS web
6. Legacy print agent, optional and disabled by default; use only when Desktop is not consuming the same printer
7. Customer Telegram agent and staff Telegram agent (same image, separate Dokploy services and credentials)

Run Prisma migrations from the backend service after PostgreSQL is reachable and before opening traffic to the web apps.

## Internal Service URLs

These should stay internal to Dokploy/private networking:

| Service                        | Internal URL                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| PostgreSQL                     | `postgres:5432` or the Dokploy-provided internal database host     |
| Redis                          | `redis:6379` when configured for cache/limit services              |
| Backend from internal services | `http://backend:4000` where supported by Dokploy networking        |
| Backend API prefix             | `http://backend:4000/api/v1` for internal service-to-service calls |

Do not expose PostgreSQL or Redis through Cloudflare public DNS.

## Public Cloudflare Domains

Expected public URLs:

| Domain                       | Target                    |
| ---------------------------- | ------------------------- |
| `https://mazettofood.uz`     | Customer web              |
| `https://www.mazettofood.uz` | Customer web              |
| `https://pos.mazettofood.uz` | POS web                   |
| `https://api.mazettofood.uz` | Backend API and Socket.IO |

The frontend production value for `NEXT_PUBLIC_API_BASE_URL` must be:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.mazettofood.uz/api/v1
```

## CORS Requirements

Backend HTTP CORS is currently not enabled in `apps/backend/src/main.ts`. For production, the API must allow browser requests from:

- `https://mazettofood.uz`
- `https://www.mazettofood.uz`
- `https://pos.mazettofood.uz`

Current warning: without explicit HTTP CORS, browser API requests from customer-web and pos-web can fail when deployed on separate domains.

## WebSocket Requirements

Socket.IO clients derive the socket URL by removing `/api/v1` from `NEXT_PUBLIC_API_BASE_URL`. With the production value above, both customer-web and pos-web connect to:

```text
https://api.mazettofood.uz
```

Cloudflare and Dokploy routing must support WebSocket upgrades on `https://api.mazettofood.uz`. Current backend websocket origin is `*`, which works broadly but should be restricted before handling sensitive realtime payloads.

## Database Connection Requirements

Use a server-side only `DATABASE_URL` for the backend:

```env
DATABASE_URL=postgresql://USER:PASSWORD@INTERNAL_POSTGRES_HOST:5432/DB_NAME
```

Requirements:

- Keep `DATABASE_URL` out of frontend services.
- Use the Dokploy internal database hostname.
- Run migrations from the backend service context.
- Ensure Prisma CLI has the same `DATABASE_URL` during migration and seed commands.

## Public vs Internal

Public:

- `https://mazettofood.uz`
- `https://www.mazettofood.uz`
- `https://pos.mazettofood.uz`
- `https://api.mazettofood.uz`

Internal only:

- PostgreSQL host and port
- Redis host and port
- `DATABASE_URL`
- JWT secrets
- Postgres bootstrap credentials

## Verification Notes

- Customer-web API connection uses `NEXT_PUBLIC_API_BASE_URL`.
- POS-web API connection uses `NEXT_PUBLIC_API_BASE_URL`.
- Customer-web order tracking derives Socket.IO origin from `NEXT_PUBLIC_API_BASE_URL`.
- POS kitchen and waiter screens derive Socket.IO origin from `NEXT_PUBLIC_API_BASE_URL`.
- Backend CORS is not currently configured for HTTP requests.
- Backend websocket CORS currently allows all origins.
