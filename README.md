# PharOS

Core platform foundations are complete, including onboarding/import flows and read-only client portal access.

## Monorepo Layout

```text
pharos/
  apps/
    web/            # Next.js App Router
  packages/
    db/             # Prisma schema + client
    core/           # Shared TypeScript library
  docker/
    docker-compose.yml
  .env.example
  package.json
  pnpm-workspace.yaml
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop (or compatible Docker engine)

## Environment

1. Copy environment file:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Run Locally

1. Install dependencies

```bash
pnpm i
```

2. One-command startup

```bash
pnpm up
```

3. Open:
- `http://localhost:3000/setup` (first run only)
- `http://localhost:3000/login`
- `http://localhost:3000/`
- `http://localhost:3000/client-demo`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/db-check`

## Useful Commands

- Stop DB: `pnpm db:down`
- Open Prisma Studio: `pnpm db:studio`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Build: `pnpm build`
- Start (production): `pnpm start`
- Reset demo dataset (app must be running): `pnpm reset:demo`
- Smoke tests (db up required): `pnpm test:smoke`


## Latest Implemented Modules

- Onboarding Wizard: `/onboarding`
  - Create empty workspace or clone from an existing workspace with data toggles.
- Import Center: `/import`
  - Bulk CSV preview + commit for SKUs, competitors, and snapshots.
- Billing & Entitlements: `/billing`
  - Plan tiers, feature entitlements, usage meters, and limit enforcement.
- Client Portal Management: `/portal`
  - Create/list/revoke shareable read-only portal tokens.
- Read-only Client Portal: `/portal/[token]`
  - Token-scoped reports: Summary, Signals, Recommendations, Applied, Margin Safety.
## Notes

- `/api/health` validates DB connectivity and returns `{ ok: true, ts: ISOString, db: true }`.
- `/api/db-check` verifies DB connectivity and returns current workspace context.
- Telemetry logging is enabled by default (`PHAROS_TELEMETRY=1`) and can be disabled with `PHAROS_TELEMETRY=0`.
- Auth is enabled with email + password sessions.
- Portal links are token-based and read-only:
  - invalid/revoked/expired tokens are blocked.
  - portal routes do not expose mutation actions.

## Auth & RBAC

- Session cookie: `pharos_sess` (HttpOnly, SameSite=Lax, 7 days).
- First setup flow: `/setup` creates first OWNER + workspace.
- Login flow: `/login` with email/password.
- Roles:
  - `OWNER`: full access including reset/clone/settings/integrations/token management/processors/delete.
  - `ANALYST`: read access + operational writes (events/snapshots/import/apply), but no owner-only operations.

## Deploy (Docker)

Build image:

```bash
docker build -t pharos .
```

Run app:

```bash
docker run -p 3000:3000 --env DATABASE_URL=postgresql://pharos:pharos@host.docker.internal:5432/pharos?schema=public pharos
```

## Production Notes

- Set production `DATABASE_URL` before build/start.
- For smoke isolation, set `DATABASE_URL_SMOKE` (otherwise it reuses `DATABASE_URL`).
- Use migration deploy flow in production:

```bash
pnpm --filter @pharos/db exec prisma migrate deploy --schema prisma/schema.prisma
```

- Health endpoint:
  - `GET /api/health` should return `ok:true` and `db:true`.
- Cookies:
  - `pharos_ws`: active workspace (30 days)
  - `pharos_demo`: client demo mode (7 days)

## Operator Runbook

- `docs/00-overview.md`
- `docs/01-local-setup.md`
- `docs/02-demo-script.md`
- `docs/03-pilot-onboarding.md`
- `docs/04-troubleshooting.md`
- `docs/05-release-checklist.md`
- `docs/06-stripe-setup.md`
- `docs/08-ops-and-cron.md`
- `docs/09-reseller-white-label.md`

## Workspace Switching & Cookie Behavior

- Workspace options are limited to memberships of the logged-in user.
- Current workspace is tracked in cookie: `pharos_ws`.
- If `pharos_ws` is missing or invalid for the current user, app falls back to the first membership workspace and syncs cookie.
- Cookie is set with:
  - `Path=/`
  - `HttpOnly`
  - `SameSite=Lax`
  - `Max-Age=2592000` (30 days)

