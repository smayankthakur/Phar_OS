# Stripe Setup

## Required Environment Variables

Set these in `.env`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_AGENCY_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID` (optional for sales-led)
- `NEXT_PUBLIC_APP_URL` (for success/cancel/portal return URLs)

## Local Webhook Forwarding (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Test Flow

1. Start app (`pnpm up` or `pnpm dev`).
2. Open `/billing` as OWNER.
3. Click upgrade button.
4. Complete checkout in Stripe test mode.
5. Verify webhook updates plan + status in DB and `/billing` reflects changes.
6. Trigger payment failure from Stripe test tools and verify status becomes `PAST_DUE`.

## Handled Stripe Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
