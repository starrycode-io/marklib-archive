# AGENTS.md

Shared module instructions for `marklib-archive/`.

## Overview

`marklib-archive/` is a Fastify service that consumes bookmark archive jobs from
RabbitMQ, generates single-file HTML archives with Chromium and uBlock Origin,
uploads them to S3-compatible storage, and publishes completion notifications.

## Commands

Run commands from `marklib-archive/`.

```bash
npm run dev
npm run build:ts
npm run watch:ts
npm test
npm start
docker build -t marklib-archive .
```

## Queue Flow

`src/plugins/mq.ts` connects to RabbitMQ on startup and configures:

- Main queue: `bookmark_archive`, receiving `{id, url}` messages.
- Dead letter queue: `bookmark_archive_dlq`.
- Dead letter exchange: `bookmark_archive_dlx`.

The consumer uses `prefetch=1`, a 15-minute timeout, and exponential backoff
retry with three attempts. Failed messages go to the DLQ.

## Archive Flow

`src/application/archive.ts` runs `single-file-cli` with Chromium, loads
uBlock Origin from `./uBOLite.chromium.mv3`, writes temporary output under
`src/temp/`, validates the generated file, uploads it to S3, sends `{id}` to
`bookmark_archive_done`, and cleans up the temporary file.

## Connections

- `src/mq/connect.ts` provides a singleton RabbitMQ connection with retry.
- `src/s3/connect.ts` provides a singleton S3-compatible client.

Call `connect()` before using `getChannel()` or the S3 client.

## Fastify Structure

- Plugins under `src/plugins/` are loaded before routes.
- Routes under `src/routes/` are loaded after plugins.
- `src/app.ts` uses AutoLoad for bootstrap order.

## Environment

RabbitMQ variables:

- `QUEUE_USERNAME`
- `QUEUE_PASSWORD`
- `QUEUE_HOST`

S3 variables:

- `S3_REGION`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`

## Testing

Tests use Node's built-in runner, `app.inject()`, and c8 coverage. Test files
live under `test/` and mirror the `src/` structure.
