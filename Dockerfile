FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --immutable
COPY . .
RUN yarn run build:ts

FROM debian:bookworm-slim AS plugin
RUN apt update && apt install -y wget curl unzip zip jq
WORKDIR /app
COPY scripts/setup-ublock.sh ./
RUN bash setup-ublock.sh

FROM node:22-bookworm-slim
RUN apt update && \
    apt install -y chromium && \
    mkdir -p chromium-profile
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY --from=build /app/dist ./dist
COPY --from=plugin /app/uBOLite.chromium.mv3 ./uBOLite.chromium.mv3
RUN corepack enable && npm install -g fastify-cli single-file-cli && yarn install --immutable --production
EXPOSE 3000
CMD ["fastify", "start", "-l", "info", "dist/app.js"]
