# Build context: monorepo root (needed for shared package)
# docker build -f gateway/Dockerfile .

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for workspace resolution
COPY gateway/package.json ./gateway/
COPY packages/shared/package.json ./packages/shared/

# Install deps (workspace-aware)
RUN pnpm install --frozen-lockfile --filter paleo-waifu-gateway...

# Copy shared package source
COPY packages/shared/src/ ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/

# Copy gateway source
COPY gateway/tsconfig.json ./gateway/
COPY gateway/src/ ./gateway/src/

WORKDIR /app/gateway
RUN pnpm build

# ─── Production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Only discord.js is external — everything else is bundled by esbuild
RUN npm init -y && npm install discord.js --ignore-scripts

COPY --from=build /app/gateway/dist ./dist

USER node

CMD ["node", "dist/index.js"]
