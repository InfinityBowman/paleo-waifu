# Build context: monorepo root (needed for shared package)
# docker build -f editor/Dockerfile .

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for workspace resolution
COPY editor/package.json ./editor/
COPY packages/shared/package.json ./packages/shared/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter creature-editor...

# Copy shared package source
COPY packages/shared/src/ ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/

# Copy editor source
COPY editor/tsconfig.json editor/tsconfig.server.json ./editor/
COPY editor/vite.config.ts editor/index.html ./editor/
COPY editor/src/ ./editor/src/

# Build client (Vite) and server (esbuild)
WORKDIR /app/editor
RUN pnpm build:client && pnpm build:server

# ─── Production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Only sharp, @aws-sdk, and dotenv are external — everything else is bundled by esbuild
RUN npm init -y && npm install sharp @aws-sdk/client-s3 dotenv

COPY --from=build /app/editor/dist ./dist

# Create images cache dir
RUN mkdir -p /app/data/images && chown node:node /app/data/images

USER node
ENV NODE_ENV=production
ENV IMAGES_DIR=/app/data/images

EXPOSE 4100

CMD ["node", "dist/server/index.js"]
