FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/telegram-bot/package.json ./apps/telegram-bot/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/telegram-bot ./apps/telegram-bot

RUN pnpm --filter telegram-bot build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 tgagent

COPY --from=builder --chown=tgagent:nodejs /app/apps/telegram-bot/package.json ./apps/telegram-bot/package.json
COPY --from=builder --chown=tgagent:nodejs /app/apps/telegram-bot/dist ./apps/telegram-bot/dist

USER tgagent

EXPOSE 7358

CMD ["node", "apps/telegram-bot/dist/main.js"]
