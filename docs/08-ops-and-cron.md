# Background Ops, Cron, and Redis

## Redis (Rate Limiting)

Rate limiting requires Redis and runs across instances.

Choose one backend:

Option A: Upstash Redis REST

- `RATE_LIMIT_BACKEND=redis`
- `UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>`
- `UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>`

Option B: Standard Redis URL

- `RATE_LIMIT_BACKEND=redis`
- `REDIS_URL=redis://:<password>@<host>:6379`

Notes:

- Redis limiter is fixed-window with TTL. Keys include route + scope + window start.

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

## Ops Page

The `/ops` page is OWNER-only and shows workspace queue sizes plus "Run now" controls.

## Queue Claiming (Multi-Instance Safety)

Shopify jobs and notification outbox claiming uses Postgres row locks:

- `FOR UPDATE SKIP LOCKED`

This prevents two servers from processing the same row at the same time.
