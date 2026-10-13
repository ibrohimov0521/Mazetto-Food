# MAZETTO FOOD

MAZETTO FOOD is a restaurant operations platform for customer ordering and branch workflows. The monorepo contains customer and staff web apps, an offline-first desktop runtime, backend APIs, Telegram integration, printer services, media tooling, and platform monitoring.

## Monorepo Structure

```text
apps/
  backend/        NestJS API, restaurant operations, authentication, and reporting
  customer-web/   Next.js online ordering and customer account experience
  desktop/        Electron offline-first branch runtime and local printing
  media/          Media container configuration, release, and validation tools
  platform-web/   Platform and tenant monitoring interface
  pos-web/        Next.js staff interface for POS and branch workflows
  print-agent/    Printer job service
  telegram-bot/   Telegram order and staff notifications
packages/
  ui/             Shared React UI primitives
```

## Requirements

- Node.js 24+
- pnpm 11+
- Docker

## Install Dependencies

```bash
pnpm install
```

## Start PostgreSQL and Redis

```bash
docker compose up -d
```

## Run Development Mode

```bash
pnpm dev
```

Applications can also be started individually:

```bash
pnpm --filter customer-web dev
pnpm --filter pos-web dev
pnpm --filter mazetto-desktop dev
pnpm --filter backend dev
pnpm --filter telegram-bot dev
pnpm --filter print-agent dev
```

## Local URLs

```text
Customer Web:
http://localhost:3000

POS:
http://localhost:3001

Desktop Gateway:
http://127.0.0.1:7359/desktop/status

Desktop update feed (optional):
MAZETTO_DESKTOP_UPDATE_URL=https://updates.example.com/mazetto-desktop/

Backend:
http://localhost:4000/api/v1

Backend Health:
http://localhost:4000/api/v1/health
```

## Root Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
```
