# GPS Server — build from monorepo root:
#   fly deploy --config apps/gps-server/fly.toml .
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/gps-server/package.json ./apps/gps-server/
COPY packages/types/package.json ./packages/types/
RUN npm ci --workspace=@gps-saas/gps-server --workspace=@gps-saas/types --include-workspace-root

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/gps-server ./apps/gps-server
COPY packages/types ./packages/types
RUN npm run build --workspace=@gps-saas/types
RUN npm run build --workspace=@gps-saas/gps-server

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/gps-server/package.json ./apps/gps-server/
COPY packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
RUN npm ci --workspace=@gps-saas/gps-server --workspace=@gps-saas/types --include-workspace-root --omit=dev

COPY --from=builder /app/apps/gps-server/dist ./apps/gps-server/dist

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 5000
EXPOSE 3001

CMD ["node", "apps/gps-server/dist/index.js"]
