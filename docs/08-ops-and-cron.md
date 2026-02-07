# Background Ops, Cron, and Redis

## Redis (Rate Limiting)

Rate limiting uses Redis when `RATE_LIMIT_BACKEND=redis` and `REDIS_URL` is set.

Environment:

- `REDIS_URL=redis://:<password>@<host>:6379`
- `RATE_LIMIT_BACKEND=redis`

Notes:

- If Redis is not configured, the app falls back to an in-memory limiter (single instance only).
- Redis limiter is fixed-window with TTL. Keys include route + scope + window bucket.

## Cron Endpoints (Scheduled Processing)

Cron endpoints are secured with a shared secret header and do not require a user session.

Environment:

- `CRON_SECRET=<random-long-secret>`

Header required on every cron request:

- `X-Pharos-Cron: <CRON_SECRET>`

Endpoints:

- `POST /api/cron/process-shopify`
- `POST /api/cron/process-notifications`
- `POST /api/cron/recalc-usage`

Example curl:

```bash
curl -X POST http://localhost:3000/api/cron/process-shopify \
  -H "Content-Type: application/json" \
  -H "X-Pharos-Cron: $CRON_SECRET" \
  -d '{ "perWorkspaceLimit": 5, "maxWorkspaces": 50 }'
```

Suggested schedule:

- Every 1 minute: `process-shopify`
- Every 1 minute: `process-notifications`
- Daily: `recalc-usage`

## Queue Claiming (Multi-Instance Safety)

Shopify jobs and notification outbox claiming uses Postgres row locks:

- `FOR UPDATE SKIP LOCKED`

This prevents two servers from processing the same row at the same time.

