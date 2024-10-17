FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:ts

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=build /app/dist ./dist
RUN npm install -g pnpm fastify-cli single-file-cli && pnpm install --prod --frozen-lockfile
EXPOSE 3000
CMD ["fastify", "start", "-l", "info", "dist/app.js"]