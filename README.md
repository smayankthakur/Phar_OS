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

## Locked Master Roadmap (Source of Truth)

This roadmap is locked for PharOS and must be kept exactly in sync for all future updates in this project.

### Phase 1 - Foundation & Signal Layer (MVP Spine)

- Step 01: Project scaffold + DB + health check {complete}
- Step 02: Tenant bootstrap + workspace context + app shell {complete}
- Step 03: SKU core (CRUD + list + detail) {complete}
- Step 04: Competitors + manual price snapshots {complete}
- Step 05: Event store + ingestion + demo simulations {complete}
- Step 06: Rules engine (IF condition -> THEN recommendation) {complete}
- Step 07: Actions + Apply flow + audit log {complete}
- Total: 7 steps

### Phase 2 - Decision -> Action Loop (Sellable Product)

- Step 08: Recommendation engine wiring (event -> rule -> action) {complete}
- Step 09: Command Center v1 (Signals / Recommendations / Applied) {complete}
- Step 10: SKU timeline (events + actions history) {complete}
- Step 11: Guardrails (margin floor, price bounds) {complete}
- Total: 4 steps

### Phase 3 - Demo Armor & Pilot Readiness

- Step 12: Demo Mode hardening (reset, scripted flows) {complete}
- Step 13: UX polish (premium UI, empty states, badges) {complete}
- Step 14: Error handling, validation, edge cases {complete}
- Step 15: Performance + indexes + basic security pass {complete}
- Total: 4 steps

### Phase 4 - Production v1 SaaS

- Step 16: Real auth (email / magic link) {complete}
- Step 17: Role enforcement (Owner vs Analyst) {complete}
- Step 18: CSV import (competitor prices, SKUs) {complete}
- Step 19: Notifications (log -> email/slack stub) {complete}
- Step 20: Deployment, envs, backups, monitoring
- Total: 5 steps

### Phase 5 - Scale & Moat Expansion (Post-Launch)

- Step 21: Real competitor scraping infra
- Step 22: Multi-channel pricing (Shopify + others)
- Step 23: Advanced pricing strategies
- Step 24: Multi-tenant analytics & reporting
- Step 25: Billing, plans, limits, reseller layer {complete}
- Total: 5 steps

## Grand Total

- Phases: 5
- Steps: 25

## Reality Check

- Steps 1-15 = 15-30 days -> demo + paid pilot ready
- Steps 1-20 = true v1 SaaS
- Steps 21-25 = scale, not survival

## Project Rule (Locked)

- Always update this README roadmap when step status changes.
- Use status markers in roadmap lines: `{complete}` for completed work.
- Keep `{complete}` markers current on every step update in this project.
- Do not alter phase names, step numbering, or scope wording unless explicitly requested.
- Treat this section as the canonical plan for the entire project.

