# MAZETTO FOOD

MAZETTO FOOD is the foundation for a production-grade restaurant platform. The system is prepared for customer web experiences, POS, backend APIs, Telegram integration, local printing, PostgreSQL, Redis, and shared packages.

This stage intentionally contains only the project foundation. Restaurant business features, ordering, authentication, payments, POS flows, Telegram integration, reporting, and printing will be added in later stages.

## Monorepo Structure

```text
apps/
  customer-web/   Next.js customer web application
  pos-web/        Next.js POS web application
  backend/        NestJS backend API
  telegram-bot/   Minimal TypeScript service entry point
  print-agent/    Minimal TypeScript service entry point
packages/
  ui/             Shared React UI primitives
  types/          Shared TypeScript types
  config/         Shared project configuration package
  api-client/     Shared API client package
infrastructure/   Future infrastructure assets
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
