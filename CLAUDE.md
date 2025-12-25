# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a bookmark archiving service built with Fastify that consumes URLs from a RabbitMQ queue, generates single-file HTML archives using Chromium with uBlock Origin, and uploads them to S3-compatible storage. The service sends completion notifications back to a message queue.

## Development Commands

### Building and Running
```bash
# Development mode (watches TypeScript files and auto-restarts)
npm run dev

# Build TypeScript
npm run build:ts

# Watch TypeScript (continuous compilation)
npm run watch:ts

# Production mode
npm start
```

### Testing
```bash
# Run all tests (builds TypeScript, compiles tests, runs with coverage)
npm test

# Tests use Node.js built-in test runner with c8 for coverage
# Test files are in test/ directory matching src/ structure
```

### Docker
```bash
# Multi-stage build that:
# 1. Builds TypeScript
# 2. Downloads and sets up uBlock Origin extension
# 3. Creates production image with Chromium
docker build -t marklib-archive .
```

## Architecture

### Message Queue Flow
The application runs as a long-lived consumer that processes bookmark archiving tasks:

1. **MQ Plugin Initialization** ([src/plugins/mq.ts](src/plugins/mq.ts)): Connects to RabbitMQ on startup and sets up:
   - Main queue: `bookmark_archive` (receives `{id, url}` messages)
   - Dead letter queue: `bookmark_archive_dlq` (for failed messages)
   - Dead letter exchange: `bookmark_archive_dlx`

2. **Message Processing**:
   - Consumes from `bookmark_archive` queue with prefetch=1 (processes one message at a time)
   - 15-minute timeout per message
   - Exponential backoff retry (3 attempts: 1s, 2s, 4s delays)
   - Failed messages after max retries go to DLQ

3. **Archive Generation** ([src/application/archive.ts](src/application/archive.ts)):
   - Uses `single-file-cli` with Chromium to generate self-contained HTML
   - Chromium runs with uBlock Origin extension loaded
   - Output saved to `src/temp/` temporarily
   - Validates generated file exists, is a file, and is non-empty

4. **Storage & Notification**:
   - Uploads HTML to S3 bucket
   - Sends `{id}` to `bookmark_archive_done` queue
   - Cleans up temporary file

### Connection Management

**Singleton Pattern**: Both MQ and S3 connections use singleton pattern to share connections across the application.

- **MQConnection** ([src/mq/connect.ts](src/mq/connect.ts)):
  - Retry logic (5 attempts, 5s delay)
  - Singleton instance shared across plugins
  - Must call `connect()` before `getChannel()`

- **OSSConnection** ([src/s3/connect.ts](src/s3/connect.ts)):
  - S3-compatible storage (configurable endpoint)
  - Lazy initialization via `connect()`
  - Singleton instance for client reuse

### Fastify Plugin Architecture

- **Plugins** ([src/plugins/](src/plugins/)): Non-encapsulated plugins loaded first, available to all routes
  - [mq.ts](src/plugins/mq.ts): MQ consumer setup (runs on startup)
  - [sensible.ts](src/plugins/sensible.ts): Fastify sensible plugin
  - [support.ts](src/plugins/support.ts): Decorator example

- **Routes** ([src/routes/](src/routes/)): Encapsulated route modules loaded after plugins
  - [root.ts](src/routes/root.ts): Health check endpoint (`GET /` returns `{root: true}`)
  - [example/](src/routes/example/): Example nested route structure

- **App Bootstrap** ([src/app.ts](src/app.ts)): AutoLoad registers plugins then routes in order

## Environment Variables

Required environment variables (see connection files for defaults):

**RabbitMQ** ([src/mq/connect.ts](src/mq/connect.ts)):
- `QUEUE_USERNAME` (default: 'guest')
- `QUEUE_PASSWORD` (default: 'guest')
- `QUEUE_HOST` (default: 'localhost:5672')

**S3** ([src/s3/connect.ts](src/s3/connect.ts)):
- `S3_REGION` (default: 'your-region')
- `S3_ENDPOINT` (default: 'https://your-custom-endpoint.com')
- `S3_ACCESS_KEY_ID` (default: 'your-access-key-id')
- `S3_SECRET_ACCESS_KEY` (default: 'your-secret-access-key')
- `S3_BUCKET_NAME` (default: 'your-bucket-name')

## Key Technical Details

### HTML Generation
The `single-file-cli` command ([src/application/archive.ts:34](src/application/archive.ts#L34)) runs Chromium with:
- Custom user agent (Windows Chrome)
- uBlock Origin extension loaded from `./uBOLite.chromium.mv3`
- 5-minute timeouts for browser load and capture
- Sandboxing disabled (`--no-sandbox`) for Docker compatibility

### Retry Mechanism
Messages are retried with exponential backoff using custom headers:
- `x-retry-count`: Tracks retry attempts (max 3)
- `x-error`: Stores error information
- Delays calculated as `Math.pow(2, retryCount) * 1000` ms
- Uses message expiration for delay implementation

### TypeScript Configuration
- Source: [src/](src/) directory
- Output: [dist/](dist/) directory
- Tests compiled separately with [test/tsconfig.json](test/tsconfig.json)
- Uses Fastify TypeBox type provider for type-safe schemas

## Testing Approach

Tests use Node.js built-in test runner with:
- `build()` helper ([test/helper.ts](test/helper.ts)) to create test app instances
- `app.inject()` for route testing (no server startup)
- c8 for coverage reporting
- Tests mirror src/ structure in test/ directory
