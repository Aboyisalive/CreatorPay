# CreatorPay

**Make creator marketing accountable.** CreatorPay is a B2B campaign
management and performance-rewards platform for Nigeria: businesses define
campaigns and terms, invite creators, track clicks and conversions, verify
evidence, calculate rewards from eligible events, settle them manually, and
learn from per-campaign reports — the workflow **Define → Manage → Track →
Verify → Calculate → Settle → Learn**.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7
(PostgreSQL), `jose` sessions, Argon2 password hashing, Zod validation and
Vitest.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then set DATABASE_URL (local PostgreSQL) and
#    AUTH_SECRET (openssl rand -hex 32 — must be ≥ 32 chars)

# 3. Create, sync and seed the database
npm run db:push
npm run db:generate
npm run db:seed

# 4. Run
npm run dev            # http://localhost:3000
```

### Reset the demo data

```bash
npm run db:push --force-reset   # drop + recreate schema
npm run db:generate
npm run db:seed                 # reprints demo credentials
```

## Demo accounts

Seeded by `npm run db:seed`, password `Password123!` for all:

| Account                  | Role                                              |
| ------------------------ | ------------------------------------------------- |
| `owner@creatorpay.test`  | Business owner — full campaign + finance access   |
| `creator@creatorpay.test`| Creator — campaigns, submissions, rewards         |
| `creator2@creatorpay.test`| Second creator (already invited to demo campaign) |

Sign in at `/login`. Business workspace lives at `/dashboard`, creator
portal at `/creator`. No payment, email, or social-media provider is
connected in V1: settlements are recorded manually and labelled as
operator-entered, and tracking limitations are surfaced in the UI.

## Scripts

| Script                | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Dev server                                 |
| `npm run build`       | Production build                           |
| `npm run start`       | Serve the production build                 |
| `npm run lint`        | ESLint                                     |
| `npm run typecheck`   | `next typegen` + `tsc --noEmit`            |
| `npm run test`        | Vitest — unit + DB-backed API/permission regression tests |
| `npm run db:push`     | Push schema to the database                |
| `npm run db:generate` | Regenerate Prisma client                   |
| `npm run db:seed`     | Seed demo workspaces/campaigns/events      |
| `npm run db:studio`   | Prisma Studio                              |

## Architecture

```
src/
├── app/
│   ├── (marketing)/            # Landing, how-it-works (public)
│   ├── (auth)/                 # Login, register
│   ├── dashboard/              # Business workspace screens
│   ├── creator/                # Creator portal screens
│   ├── r/[token]/              # Tracking-link redirect (records click)
│   ├── health/{live,ready}/    # Liveness / readiness probes
│   └── api/v1/                 # ~65 route handlers (see docs/API.md)
├── components/                 # UI shell, primitives, dialogs
├── lib/                        # auth, rbac, money, attribution, events…
└── proxy.ts                    # Session guard for /dashboard, /creator
prisma/                        # Schema + seed
docs/API.md                    # Full API contract
```

### Domain rules the code enforces

- **Entitlement ≠ payment.** Rewards flow CALCULATED → APPROVED → PAYABLE →
  PAID; approval never implies money moved, and settlements are
  operator-entered records (`method` + `reference`) — never
  provider-confirmed.
- **Verification and eligibility are separate axes**, each with a recorded
  reason. Test events (`isTest`) are always INELIGIBLE and never enter
  reward calculations.
- **Attribution**: last eligible click inside the campaign's configurable
  window; unknown stays unattributed (UNDER_REVIEW/INELIGIBLE) with the
  reason stored.
- **Terms are versioned.** Publishing locks a term version; participants
  accept a snapshot; reward calculations reference the accepted version.
- **Money is decimal-safe**: stored as integer minor units (kobo) in
  `BigInt` columns, serialized as strings over the API.
- **Idempotent events**: unique on `(campaignId, externalEventId)`; replays
  return the original with `duplicate: true`.
- **Adjustments, not deletions**: recalculation creates new reward versions;
  nothing is deleted in place.
- **Audit trail** on meaningful actions; **tenant isolation** and backend
  RBAC (OWNER / ADMIN / CAMPAIGN_MANAGER / REVIEWER / FINANCE / ANALYST) on
  every route.

## Testing

```bash
npm run test
```

- Pure unit tests for money, attribution, reward math and validation
  schemas.
- DB-backed API integration tests (`src/lib/api-regression.test.ts`) call
  route handlers directly against the **local dev database** with mocked
  session cookies. They create their own fixtures (unique `it-*-…@creatorpay.test`
  users/workspaces) and clean them up, covering: 401 unauthenticated, 403
  cross-tenant and role denial, event idempotency, test-event exclusion,
  validation errors, and notification ownership.

## Known limitations (V1)

- **No payment provider** — settlements are manual records with an audit
  note; the UI labels them operator-entered.
- **No email provider** — invitations and notifications are in-app only.
  Invitation links are shown in the UI for manual sharing.
- **No social-platform APIs** — creator posts are not auto-ingested;
  evidence is URL/text submissions reviewed by the business.
- **Single workspace per account**; no marketplace, no queues, no Redis
  (as scoped for the MVP).
- **Ops tooling** (error monitoring, backup automation, deployment
  pipeline, staging) is out of scope for the repo; `/health/live` and
  `/health/ready` probes are provided for external monitoring.
- Money minor units are stored in `BigInt` kobo columns rather than
  `NUMERIC` decimals; this is deliberate (exact integer arithmetic) but
  differs from the original roadmap sketch.
