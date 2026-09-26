FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/customer-web/package.json ./apps/customer-web/package.json
COPY apps/pos-web/package.json ./apps/pos-web/package.json
COPY apps/platform-web/package.json ./apps/platform-web/package.json
COPY apps/print-agent/package.json ./apps/print-agent/package.json
COPY apps/telegram-bot/package.json ./apps/telegram-bot/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

ARG BESTTEAM_API_INTERNAL_URL
ENV BESTTEAM_API_INTERNAL_URL=$BESTTEAM_API_INTERNAL_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN test -n "$BESTTEAM_API_INTERNAL_URL"
RUN pnpm exec turbo run build --filter=platform-web
RUN node -e 'const m=require("./apps/platform-web/.next/routes-manifest.json");const r=[...m.rewrites.beforeFiles,...m.rewrites.afterFiles,...m.rewrites.fallback];if(!r.some(x=>x.source==="/api/v1/:path*"&&x.destination===`${process.env.BESTTEAM_API_INTERNAL_URL}/api/v1/:path*`))throw new Error("Platform API rewrite missing from build output")'

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/platform-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform-web/.next/static ./apps/platform-web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/platform-web/server.js"]
