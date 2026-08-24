# MAZETTO FOOD Dokploy Deployment Checklist

This checklist prepares MAZETTO FOOD for production deployment on Dokploy. It is documentation only and does not perform deployment.

## Required Services

1. PostgreSQL
2. Backend
3. POS Web
4. Customer Web

Optional future services such as Redis, Telegram Bot, and Print Agent should be deployed only after their production logic and environment variables are implemented.

## Deployment Order

```text
PostgreSQL
↓
Backend
↓
POS Web
↓
Customer Web
```

## Service Environment Variables

### PostgreSQL

| Variable | Required | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | Yes | Database bootstrap user. |
| `POSTGRES_PASSWORD` | Yes | Use a strong secret. |
| `POSTGRES_DB` | Yes | Production database name. |

PostgreSQL must stay internal and must not be exposed through a public Cloudflare domain.

### Backend

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production`. |
| `BACKEND_PORT` | Optional | Defaults to `4000`; set explicitly in Dokploy if the service expects a fixed port. |
| `DATABASE_URL` | Yes | Use the internal Dokploy PostgreSQL hostname and credentials. |
| `JWT_ACCESS_SECRET` | Yes | Strong production-only secret. |
| `JWT_REFRESH_SECRET` | Yes | Strong production-only secret, different from access secret. |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Optional | Defaults to `900`. |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Optional | Defaults to `604800`. |

Dokploy service settings:

| Setting | Value |
| --- | --- |
| Build context | `/` |
| Dockerfile | `apps/backend/Dockerfile` |
| Container port | `4000` |
| Production startup command | `node apps/backend/dist/main.js` |

### POS Web

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `https://api.mazettofood.uz/api/v1` |

Dokploy service settings:

| Setting | Value |
| --- | --- |
| Build context | `/` |
| Dockerfile | `apps/pos-web/Dockerfile` |
| Container port | `3000` |
| Build argument | `NEXT_PUBLIC_API_BASE_URL=https://api.mazettofood.uz/api/v1` |
| Production startup command | `node apps/pos-web/server.js` |

### Customer Web

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `https://api.mazettofood.uz/api/v1` |

Dokploy service settings:

| Setting | Value |
| --- | --- |
| Build context | `/` |
| Dockerfile | `apps/customer-web/Dockerfile` |
| Container port | `3000` |
| Production startup command | `node apps/customer-web/server.js` |

## Internal Networking Requirements

Backend must connect to PostgreSQL through Dokploy internal networking:

```text
Backend → PostgreSQL
```

Use an internal database hostname in `DATABASE_URL`, for example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@INTERNAL_POSTGRES_HOST:5432/DB_NAME
```

Backend should also use internal networking for future internal services when they become active:

```text
Backend → internal services
```

Do not route database, Redis, print-agent, or Telegram bot internals through public Cloudflare DNS.

## Public Domains

| Domain | Service |
| --- | --- |
| `https://mazettofood.uz` | Customer Web |
| `https://www.mazettofood.uz` | Customer Web |
| `https://api.mazettofood.uz` | Backend |
| `https://pos.mazettofood.uz` | POS Web |

Cloudflare must allow WebSocket upgrades for `https://api.mazettofood.uz` because POS and Customer Web derive Socket.IO from `NEXT_PUBLIC_API_BASE_URL`.

## Migration Commands

Run from the backend service context after PostgreSQL is available and before public traffic is opened:

```bash
pnpm --dir apps/backend exec prisma migrate deploy
pnpm --dir apps/backend exec prisma db seed
```

The backend service must have `DATABASE_URL` available for both commands.
Do not run migrations automatically in the backend container startup command.

## Health Checks

### Backend

Recommended public health check:

```text
GET https://api.mazettofood.uz/api/v1/health
```

The backend health endpoint should confirm service status and database reachability.

### POS Web

Recommended public check:

```text
GET https://pos.mazettofood.uz/api/health
```

### Customer Web

Recommended public checks:

```text
GET https://mazettofood.uz/api/health
GET https://www.mazettofood.uz/api/health
```

### PostgreSQL

Use Dokploy/internal database health checks only. PostgreSQL should have no public endpoint.

## Rollback Notes

1. Keep the previous successful Dokploy image/version for each service.
2. Roll back web services first if the failure is frontend-only:
   - POS Web
   - Customer Web
3. Roll back Backend only if API behavior, authentication, CORS, migrations, or websocket behavior fails.
4. Do not roll back PostgreSQL data blindly after migrations.
5. If a migration causes issues, create a forward fix migration whenever possible.
6. Before backend rollback, confirm the older backend version is compatible with the current database schema.
7. Keep production secrets unchanged during rollback unless the incident is secret-related.

## Final Pre-Deployment Checks

- PostgreSQL service is running internally.
- PostgreSQL port `5432` is not exposed publicly.
- Backend has production `DATABASE_URL`.
- Backend has strong JWT secrets.
- Backend CORS allows:
  - `https://mazettofood.uz`
  - `https://www.mazettofood.uz`
  - `https://pos.mazettofood.uz`
- Backend websocket CORS allows the same production web domains.
- POS Web and Customer Web both use `NEXT_PUBLIC_API_BASE_URL=https://api.mazettofood.uz/api/v1`.
- Cloudflare DNS points each public domain to the correct Dokploy service.
- Cloudflare WebSocket support is enabled for the API domain.
- `prisma migrate deploy` has completed.
- `prisma db seed` has completed.
- Public health checks pass.
