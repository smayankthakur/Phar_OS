# Pilot Release Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] `pnpm test:smoke` passes
- [ ] `/api/health` returns `ok:true` and `db:true`
- [ ] `/api/demo/reset` works
- [ ] Demo simulation generates recommendations
- [ ] Applying recommendation creates audit
- [ ] Client demo mode restrictions verified (delete disabled)
- [ ] Guardrails tested (clamp + block scenarios)
- [ ] CSV preview + commit tested
- [ ] Export dataset endpoint downloads JSON
- [ ] Telemetry toggle tested (`PHAROS_TELEMETRY=0` disables logging)
- [ ] Backup database plan prepared
- [ ] Production `.env` values reviewed before deploy
