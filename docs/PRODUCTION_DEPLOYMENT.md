# MAZETTO FOOD Production Deployment Audit

Phase 6B prepares the monorepo for Dokploy and Cloudflare deployment. This document inventories environment variables currently used by code or local deployment configuration and records production wiring requirements.

## Environment Inventory

### BACKEND

| Variable | Required | Secret/Public | Runtime/Build-time | Description |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Required in production | Public | Runtime | Enables production-only checks for required JWT secrets. Set to `production` in Dokploy. |
| `BACKEND_PORT` | Optional | Public | Runtime | NestJS listen port. Defaults to `4000` when omitted. |
| `DATABASE_URL` | Required | Secret | Runtime and Prisma CLI | PostgreSQL connection string used by `PrismaService` and `prisma.config.ts`. |
| `JWT_ACCESS_SECRET` | Required in production | Secret | Runtime | Secret used to sign JWT access tokens. Backend throws in production if missing. |
| `JWT_REFRESH_SECRET` | Required in production | Secret | Runtime | Secret used to sign JWT refresh tokens. Backend throws in production if missing. |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Optional | Public | Runtime | Access token lifetime in seconds. Defaults to `900`. |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Optional | Public | Runtime | Refresh token lifetime in seconds. Defaults to `604800`. |

### CUSTOMER-WEB

| Variable | Required | Secret/Public | Runtime/Build-time | Description |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Required for production | Public | Build-time and browser runtime | Public backend API base URL used by customer-web fetch calls and Socket.IO base derivation. Production value: `https://api.mazettofood.uz/api/v1`. |

### POS-WEB

| Variable | Required | Secret/Public | Runtime/Build-time | Description |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Required for production | Public | Build-time and browser runtime | Public backend API base URL used by POS auth/API fetch calls and Socket.IO base derivation. Production value: `https://api.mazettofood.uz/api/v1`. |

### POSTGRES

| Variable | Required | Secret/Public | Runtime/Build-time | Description |
| --- | --- | --- | --- | --- |
| `POSTGRES_USER` | Required only for local compose/Postgres service creation | Secret | Service startup | PostgreSQL bootstrap user used by `docker-compose.yml`. |
| `POSTGRES_PASSWORD` | Required only for local compose/Postgres service creation | Secret | Service startup | PostgreSQL bootstrap password used by `docker-compose.yml`. |
| `POSTGRES_DB` | Required only for local compose/Postgres service creation | Public | Service startup | PostgreSQL bootstrap database name used by `docker-compose.yml`. |
| `DATABASE_URL` | Required by backend | Secret | Runtime and Prisma CLI | Backend-facing PostgreSQL URL. In Dokploy, point this at the internal Postgres hostname, not Cloudflare. |

### REDIS

No Redis environment variables are currently read by application code. `docker-compose.yml` defines a Redis service, but no code reads `REDIS_URL` or equivalent yet.

### TELEGRAM BOT

No Telegram bot environment variables are currently read. `apps/telegram-bot/src/main.ts` only starts a placeholder service and does not read bot tokens, webhook URLs, or API URLs yet.

### PRINT SERVICE

No print-agent environment variables are currently read. `apps/print-agent/src/main.ts` only starts a placeholder service. Printer records are managed through the backend database, not environment variables.

## Integrations Not Yet Environment-Backed

| Area | Current status |
| --- | --- |
| Redis config | Redis service exists in compose, but application code does not use it. |
| WebSocket config | Backend gateway allows `origin: "*"`, and clients derive socket origin from `NEXT_PUBLIC_API_BASE_URL`. No dedicated socket env exists. |
| CORS config | Backend HTTP CORS is not explicitly enabled in `main.ts`. No CORS env exists. |
| Telegram bot config | No token, webhook, or API URL env is used. |
| Printer/receipt config | No printer host, queue, or agent key env is used. |
| Instagram integrations | No Instagram env is used. |
| Payment integrations | Click, Payme, Uzcard, Humo, card, and online methods exist as business values only. No provider secret/env is used. |

## Dokploy Service Order

1. PostgreSQL
2. Redis, optional for current code because no application reads it yet
3. Backend API
4. Customer web
5. POS web
6. Print agent, optional placeholder until printer service logic is implemented
7. Telegram bot, optional placeholder until bot integration logic is implemented

Run Prisma migrations from the backend service after PostgreSQL is reachable and before opening traffic to the web apps.

## Internal Service URLs

These should stay internal to Dokploy/private networking:

| Service | Internal URL |
| --- | --- |
| PostgreSQL | `postgres:5432` or the Dokploy-provided internal database host |
| Redis | `redis:6379` if Redis becomes used later |
| Backend from internal services | `http://backend:4000` where supported by Dokploy networking |
| Backend API prefix | `http://backend:4000/api/v1` for internal service-to-service calls |

Do not expose PostgreSQL or Redis through Cloudflare public DNS.

## Public Cloudflare Domains

Expected public URLs:

| Domain | Target |
| --- | --- |
| `https://mazettofood.uz` | Customer web |
| `https://www.mazettofood.uz` | Customer web |
| `https://pos.mazettofood.uz` | POS web |
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
