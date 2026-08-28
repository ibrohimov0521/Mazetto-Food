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

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_MEDIA_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL

RUN pnpm exec turbo run build --filter=customer-web

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/customer-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/customer-web/.next/static ./apps/customer-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/customer-web/public ./apps/customer-web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/customer-web/server.js"]
