# Troubleshooting

## DB Not Reachable

Symptoms:
- `/api/health` returns `ok:false` or server errors.

Fix:

```bash
pnpm db:up
pnpm db:migrate
```

Check:

```bash
curl http://localhost:3000/api/health
```

## Migration Failed

Fix:

```bash
pnpm db:migrate
```

If Prisma client lock issues occur on Windows, stop running Node processes and retry.

## Cookie Workspace Mismatch

Symptoms:
- Data appears from wrong workspace or empty unexpectedly.

Fix:
- Re-select workspace in topbar switcher.
- Optionally clear browser cookies for localhost and reload.

## Action Blocked By Guardrails

Symptoms:
- Recommendation shows `BLOCKED` or apply returns conflict.

Fix:
- Check `/settings` guardrails.
- Lower `minMarginPercent` or increase `maxPriceChangePercent` if business-approved.
- Re-run simulation.

## CSV Import Errors

Common causes:
- Missing headers `competitor_name` / `price`
- Invalid price (`<=0` or non-number)
- Invalid `captured_at`
- Unknown competitor without “Create missing competitors”

Fix:
- Correct CSV format.
- Use preview first.
- Enable “Create missing competitors” when needed.
