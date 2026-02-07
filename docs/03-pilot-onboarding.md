# Pilot Onboarding

## 1) Create Client Workspace

- Use `/client-demo` for fast seeded client workspace.
- Or create a workspace via workspace selector/API and seed baseline data.

## 2) Add Operational Entities

- Create SKUs (`/skus/new`).
- Add competitors (`/competitors`).
- Configure guardrails (`/settings`).

## 3) Import Competitor CSV

Use SKU page -> **Competitor Prices** -> **Import CSV**.

CSV format:

```csv
competitor_name,price,captured_at
DemoMart,115.50,2026-02-01
PriceKing,123.00,2026-02-02T10:30:00Z
```

## 4) Guardrail Guidance

- `minMarginPercent`: start at `10-20` for conservative pilots.
- `maxPriceChangePercent`: start at `5-15`.
- `roundingMode`: `NEAREST_1` for practical pricing.

## 5) Pilot KPIs

- Recommended actions generated/day.
- Applied actions/day.
- Blocked actions due to guardrails.
- Average time from signal to apply.
- Margin-safe apply ratio.
