# GPS Server Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY apps/gps-server/package.json ./
COPY packages/types/package.json ./packages/types/
RUN npm install --production

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/gps-server/src ./src
COPY apps/gps-server/tsconfig.json ./
COPY packages/types/src ./packages/types/src
RUN npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 5000
EXPOSE 3001

CMD ["node", "dist/index.js"]
