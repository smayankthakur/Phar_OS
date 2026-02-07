# PharOS Overview

PharOS is a multi-tenant pricing operations command center for pilots and early SaaS deployments. It ingests market and inventory signals, evaluates rules, recommends safe actions with guardrails, and tracks execution via timeline and audit logs.

## Architecture (ASCII)

```text
                    +----------------------+
                    |   apps/web (Next)    |
                    |  UI + API Handlers   |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |    packages/core     |
                    | Rules + Guardrails   |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |     packages/db      |
                    | Prisma + Postgres    |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |      PostgreSQL      |
                    | Source of Truth      |
                    +----------------------+
```

## Modules

- `apps/web`: Next.js app (App Router), API handlers, pages, shell UI.
- `packages/core`: domain logic (events, pricing, guardrails, rule engine).
- `packages/db`: Prisma schema and client.
- `docker/`: local PostgreSQL compose file.
- `docs/`: runbooks for operators and pilot execution.
