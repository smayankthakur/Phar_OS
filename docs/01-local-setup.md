# Local Setup

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop (or compatible Docker engine)

## First Run

```bash
pnpm i
pnpm up
```

Open:

- `http://localhost:3000/client-demo`
- `http://localhost:3000/setup` (first run)
- `http://localhost:3000/login`

## What `pnpm up` does

1. Starts PostgreSQL via docker compose.
2. Runs Prisma migrations.
3. Starts the web dev server.

## Reset Demo Dataset

With app running:

```bash
pnpm reset:demo
```

If the script cannot call your local app, run manually:

```bash
curl -X POST http://localhost:3000/api/demo/reset
```

## Auth Setup Flow

1. Open `/setup` and create first OWNER account + workspace.
2. Login via `/login`.
3. Use workspace switcher for membership-scoped workspace access.
