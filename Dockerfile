FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:ts

FROM debian:bookworm-slim AS plugin
RUN apt update && apt install -y wget curl unzip zip jq
WORKDIR /app
COPY scripts/setup-ublock.sh ./
RUN bash setup-ublock.sh

FROM node:20-bookworm-slim
RUN apt update && \
    apt install -y chromium && \
    mkdir -p chromium-profile
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=build /app/dist ./dist
COPY --from=plugin /app/uBOLite.chromium.mv3 ./uBOLite.chromium.mv3
RUN npm install -g pnpm fastify-cli single-file-cli && pnpm install --prod --frozen-lockfile
EXPOSE 3000
CMD ["fastify", "start", "-l", "info", "dist/app.js"]
