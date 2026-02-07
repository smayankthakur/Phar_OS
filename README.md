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
- Backup DB (requires `pg_dump`): `pnpm db:backup`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Build: `pnpm build`
- Start (production): `pnpm start`
- Start (production alias): `pnpm start:prod`
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
pnpm migrate:prod
```

Production run flow:

```bash
pnpm build
pnpm migrate:prod
pnpm start:prod
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
- `docs/07-backups.md`
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

<<<<<<< HEAD
## Locked Master Roadmap (Source of Truth)

This roadmap is locked for PharOS and must be kept exactly in sync for all future updates in this project.

### Phase 1 — Core App MVP (Steps 01–10)

Outcome: Working closed-loop "Signal -> Recommend -> Apply -> Audit" MVP + premium UI.

- Step 01: Repo + monorepo scaffold + app shell (workspace cookie, layout) { `complete` }
- Step 02: Core DB models: Workspace, SKU, basic CRUD { `complete` }
- Step 03: SKU pages + list/detail UX { `complete` }
- Step 04: Competitors + snapshots (manual) + SKU competitor panel { `complete` }
- Step 05: Event store + ingest + demo simulations { `complete` }
- Step 06: Rules engine -> recommendations generation { `complete` }
- Step 07: Apply action -> update SKU + audit log { `complete` }
- Step 08: SKU timeline (events + actions + audits) + audit modal { `complete` }
- Step 09: Demo reset + deterministic dataset + guided demo page { `complete` }
- Step 10: Premium UI polish + health endpoint + deploy-ready config { `complete` }

### Phase 2 — Pilot Readiness (Steps 11–15)

Outcome: Safe pilot execution with guardrails + import/export + docs + testability.

- Step 11: Pricing guardrails (min margin / max change / rounding) + blocked actions { `complete` }
- Step 12: CSV import (snapshots) with preview + commit { `complete` }
- Step 13: Client Demo Mode landing + seeded workspace creation + demo script inside app { `complete` }
- Step 14: Runbook + /help + "pnpm up" + operational docs { `complete` }
- Step 15: Smoke tests + export dataset + minimal telemetry logging { `complete` }

### Phase 3 — Enterprise Foundations (Steps 16–20)

Outcome: Onboarding, client portal, integrations stubs, notifications, real auth/RBAC.

- Step 16: Onboarding wizard + workspace cloning + Import Center + CSV templates { `complete` }
- Step 17: Read-only client portal via token + reports + revocation { `complete` }
- Step 18: Shopify adapter stub + job queue + DRY_RUN/LIVE + processing { `complete` }
- Step 19: Notifications outbox (email/webhook) + dispatcher + ops UI { `complete` }
- Step 20: Authentication + sessions + RBAC + actor-attributed audit integrity { `complete` }

### Phase 4 — Monetization (Steps 21–22)

Outcome: Plan system + Stripe subscription sync driving entitlements.

- Step 21: Plans + entitlements + usage metering + billing UI (manual plan switch) { `complete` }
- Step 22: Stripe checkout + portal + webhook sync + billing-state gating (past_due/canceled) { `complete` }

### Phase 5 — Scale + White-Label (Steps 23–25)

Outcome: Production security, HA posture, reseller layer.

- Step 23: Security hardening (headers, CSRF, rate limit, backups, prod migrations, observability) { `complete` }
- Step 24: Redis rate limiting + SKIP LOCKED durable queues + cron endpoints + /ops { `complete` }
- Step 25: Reseller layer: reseller accounts, branding, domain mapping, plan overrides { `complete` }

### Phase 6 — Enterprise Expansion (Steps 26–30)

Outcome: Big-deal readiness + compliance + ecosystem.

- Step 26: Enterprise controls (audit export CSV/JSON, retention policies, data access logs; invite flows / SCIM-lite provisioning; SSO placeholder architecture with SAML/OIDC-ready interfaces)
- Step 27: Compliance & governance pack (GDPR delete/export per workspace; data residency flags + DPA-ready config; PII minimization checklist)
- Step 28: ROI analytics & reporting (margin uplift tracking before/after; action impact attribution; weekly PDF/CSV reports download)
- Step 29: Integrations framework (marketplace-ready) (adapter interface pattern: Shopify -> "connectors"; webhook receiver framework + signing; import mappings per connector)
- Step 30: Launch & SLA packaging (runbooks for support; uptime posture + incident process; final pricing, onboarding checklist, "go-live kit")

## Project Rule (Locked)

- Always update this README roadmap when step status changes.
- Use status markers in roadmap lines: `{ `complete` }` for completed work.
- Keep `{ `complete` }` markers current on every step update in this project.
- Do not alter phase names, step numbering, or scope wording unless explicitly requested.
- Treat this section as the canonical plan for the entire project.

=======
>>>>>>> 121427c3ed5525306c59487d8b47acb7e64bb892
