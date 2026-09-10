FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/print-agent/package.json ./apps/print-agent/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/print-agent ./apps/print-agent

RUN pnpm --filter print-agent build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 printagent

COPY --from=builder --chown=printagent:nodejs /app/apps/print-agent/package.json ./apps/print-agent/package.json
COPY --from=builder --chown=printagent:nodejs /app/apps/print-agent/dist ./apps/print-agent/dist

USER printagent

CMD ["node", "apps/print-agent/dist/main.js"]
