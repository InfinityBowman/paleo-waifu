FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build

FROM node:22-alpine

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

USER node

CMD ["node", "dist/index.js"]
