# Reseller + White-Label (MVP)

## Concept

A reseller (partner) sits above workspaces:

- Reseller -> many client workspaces
- Users can be members of a reseller with roles:
  - `RESELLER_OWNER`
  - `RESELLER_ADMIN`
  - `RESELLER_SUPPORT`

Reseller is optional. Existing standalone workspaces are unaffected.

## Branding

Branding fields live on the reseller and apply to:

- The app shell (Topbar app name/logo)
- The client portal (`/portal/[token]`)

Fields:

- `brandName` (display)
- `appName` (Topbar app label override)
- `logoUrl` (image URL)
- `accentColor` (hex string, used for primary buttons)
- `supportEmail`

Branding resolution order:

1. If request `Host` matches a verified `ResellerDomain`, use that reseller branding.
2. Else if current workspace has `resellerId`, use that reseller branding.
3. Else default PharOS branding.

## Domains

You can map a domain to a reseller:

- Stored as `ResellerDomain.domain`
- Manual verification for MVP: click "Mark verified" in `/reseller`

No DNS/SSL automation is included.

## Plan Overrides

Each workspace can optionally specify:

- `planOverride` (PlanTier)
- `billingManagedByReseller` (boolean)

Entitlements behavior:

- If `planOverride` is set, limits/features are enforced using the override plan.
- If `billingManagedByReseller=true`, billing status gating (PAST_DUE/CANCELED) is bypassed for that workspace.

## UI

- Reseller dashboard: `/reseller`
  - Clients (create client workspace, set plan override)
  - Branding (edit reseller branding)
  - Domains (map + verify domains)

