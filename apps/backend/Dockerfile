FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS deps

COPY . .

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app ./

RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV BACKEND_PORT=4000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs

EXPOSE 4000

CMD ["node", "apps/backend/dist/main.js"]
