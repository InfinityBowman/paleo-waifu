# Build context: monorepo root (needed for schema.ts)
# docker build -f tools/pipeline-dashboard/Dockerfile .

FROM node:22-alpine AS build

WORKDIR /app/editor

RUN corepack enable pnpm

# Install deps
COPY tools/pipeline-dashboard/package.json tools/pipeline-dashboard/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy editor source
COPY tools/pipeline-dashboard/tsconfig.json tools/pipeline-dashboard/tsconfig.server.json ./
COPY tools/pipeline-dashboard/vite.config.ts tools/pipeline-dashboard/index.html ./
COPY tools/pipeline-dashboard/src/ ./src/

# Vendor the shared schema
RUN mkdir -p src/server/vendor
COPY src/lib/db/schema.ts ./src/server/vendor/schema.ts

# Build client (Vite) and server (tsc)
RUN pnpm build

# ─── Production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

RUN corepack enable pnpm

COPY tools/pipeline-dashboard/package.json tools/pipeline-dashboard/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/editor/dist ./dist

# Create images cache dir
RUN mkdir -p /app/data/images && chown node:node /app/data/images

USER node

ENV NODE_ENV=production
ENV IMAGES_DIR=/app/data/images

EXPOSE 4100

CMD ["node", "dist/server/index.js"]
