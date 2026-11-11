# CreatorPay --- MVP Build Plan

**Status:** Implementation plan derived from `CreatorPay_Product.md`\
**Product:** CreatorPay\
**Launch market:** Nigeria\
**Frontend:** Next.js, React, TypeScript\
**Backend:** Next.js Route Handlers and Server Actions (same application)\
**Database:** PostgreSQL\
**Architecture:** Single Next.js full-stack application; backend extraction deferred\
**Document purpose:** Build a substantial, end-to-end MVP that can be
demonstrated with realistic campaign data and complete workflows, while
clearly separating the MVP from V2 and V3.

------------------------------------------------------------------------

## 0. Source-of-truth rule

`CreatorPay_Product.md` is the product source of truth. This build plan
translates it into an implementation sequence; it does not redefine the
product.

Where the product definition explicitly leaves a decision open, this
plan marks it as an MVP implementation decision or a validation item
rather than presenting it as a settled product fact. In particular:

-   Payment provider, custody, escrow, and funding policy are not
    assumed to be solved.
-   Social-platform APIs and automatic social analytics are not assumed
    to be available.
-   Attribution is evidence-based and imperfect; a click is not a
    conversion.
-   Businesses can bring creators they already know. A creator
    marketplace is not a prerequisite.
-   Fixed deliverable compensation must remain distinct from performance
    rewards.
-   The product is not dependent on blockchain or tokens.
-   V1, V2, and V3 are implementation phases, not promises that every
    long-term feature will ship on a particular date.

## 1. Product outcome and MVP definition

CreatorPay helps businesses run creator campaigns from agreed terms
through deliverables, available tracking evidence, reward calculation,
and settlement status. It gives creators a clear view of campaign terms,
their obligations, their evidence, their reward breakdown, and the
status of payment.

The MVP must be a real product, not a set of empty dashboard screens. A
judge or pilot customer must be able to complete the following connected
journey:

1.  A business creates an account and workspace.
2.  It creates a campaign with an objective, deliverable, schedule,
    destination, attribution rule, and reward rule.
3.  It invites a creator by email or shareable invitation.
4.  The creator signs in, reads the campaign terms, and accepts them.
5.  CreatorPay issues a creator-specific tracking link.
6.  A visitor opens that link; the system records a click and redirects
    to the business destination.
7.  The creator submits a public content URL or evidence for a required
    deliverable.
8.  The business reviews the submission and approves it or requests a
    revision.
9.  A business test event or a properly authenticated conversion event
    is ingested, deduplicated, and attributed where evidence supports
    it.
10. The business reviews eligible events and calculates rewards using
    the campaign's agreed rule.
11. The business approves the reward; the creator can see the
    calculation and its status.
12. The business records a manual settlement confirmation in the MVP,
    with actor, timestamp, reference, and audit history. The interface
    clearly distinguishes this record from provider-confirmed payment.
13. The business sees campaign analytics and can export a report.

This is the minimum coherent demonstration of **Define → Manage → Track
→ Verify → Calculate → Settle → Learn**.

### MVP acceptance rule

A feature is not complete merely because a screen exists. It is complete
when the user can perform the action, the backend enforces its rules,
the database records the outcome, permission boundaries are checked, and
the relevant other user's screen reflects the change.

## 2. Scope: V1 vs V2 vs V3

### V1 --- Substantial MVP / pilot-ready core

**Goal:** Complete one end-to-end campaign accountability loop for a
business and its invited creators.

Included:

-   Next.js web app with responsive public marketing site and
    authenticated app.
-   Business registration/sign-in, workspace creation, current-user
    profile, and role checks.
-   One business workspace per account in the first onboarding path;
    data model supports memberships and roles.
-   Business overview dashboard with real database-backed counts,
    campaign status, pending submissions, event/reward summaries, and
    recent activity.
-   Campaign CRUD: draft, validation, preview, publish, pause/resume,
    close/archive where applicable.
-   Campaign terms version snapshots; accepted version recorded for each
    participant.
-   Invite existing creators by email or create a shareable invitation
    URL. Do not require a public marketplace.
-   Creator account/profile basics and creator campaign portal.
-   Accept/decline invitation; creator must accept terms before
    participation activates.
-   Deliverable requirements, deadlines, content URL/evidence
    submission, review, approval, rejection, and revision request.
-   Opaque creator-specific tracking links and safe redirect endpoint.
-   Click records and campaign/creator click analytics, labelled as
    clicks rather than conversions.
-   Conversion event ingestion through an authenticated server endpoint,
    with test/live distinction, idempotency, source provenance, basic
    attribution-window checks, and review status.
-   Manual event review and eligibility decision with recorded reasons.
-   MVP reward rules: fixed approved-deliverable fee, per-eligible-event
    reward, and hybrid combination; currency/rounding and cap
    validation. Defer complex tiered/multi-objective rules unless they
    are necessary for a validated pilot.
-   Reward calculation preview and stored calculation snapshot,
    including input events and rule version.
-   Business approval and creator-facing reward breakdown/status.
-   Manual settlement recording only. No claim of escrow, custody, or
    automatic payout. A payment provider can be integrated later after
    the provider and compliance decision.
-   Campaign analytics and creator analytics based on available records.
-   CSV export for campaign report/reward ledger.
-   Audit events for key actions and an activity history.
-   Seed/demo data and a guided demo path that uses the same application
    logic as live records.
-   API docs, automated tests for critical domain rules, error
    monitoring, database backups, and separate development/production
    configuration.

Explicit V1 exclusions:

-   Public searchable creator marketplace and recommendation engine.
-   Agency multi-client workspace management beyond basic extensible
    data structures.
-   Paid subscription billing and plan enforcement.
-   Automatic payout execution, escrow, custody, or
    fund-before-publication logic.
-   Direct integrations with every social network.
-   Automatic extraction of views, likes, comments, or audience data
    from social accounts.
-   Advanced fraud scoring or claims that a person is fraudulent.
-   Complex multi-touch attribution, probabilistic identity matching, or
    claims of causal ROI.
-   AI campaign optimisation, creator scoring, or automated decisions.
-   Mobile native applications.
-   Microservices, event streaming infrastructure, and premature scaling
    work.

### V2 --- Integration-ready growth product

**Goal:** Reduce manual work for recurring campaigns and support
businesses with larger operational needs.

Candidate scope, prioritised by pilot evidence:

-   Provider-backed payouts and verified payment callbacks, after
    legal/provider review.
-   CSV imports with mapping, preview, validation, duplicate detection,
    import history, and correction flow.
-   More complete event integrations, scoped API credentials, test-event
    tooling, delivery logs, and signed outbound webhooks.
-   Reward tiers, milestones, additional event types, reversals/refunds,
    and richer campaign rule composition.
-   Team invitations and fuller role-based permissions.
-   Agency workspaces, explicit client connections, client-level access
    boundaries, and client-specific reporting.
-   Public campaign opportunities and creator applications where
    customer evidence supports discovery.
-   Email notifications and configurable reminders.
-   More advanced reports, date filtering, campaign comparisons, and
    export options.
-   Integration retry tooling, reconciliation views, stronger
    suspicious-activity review, and operational admin tools.
-   Subscription billing and plan limits if pricing validation supports
    them.
-   Supported social-platform integrations only after access,
    permissions, reliability, and commercial value are confirmed.

### V3 --- Scale and ecosystem expansion

**Goal:** Make CreatorPay a mature campaign operations platform with
extensible integrations and repeatable multi-customer operations.

Candidate scope:

-   Broader API product and stable versioning policy.
-   More integration partners and reusable integration adapters.
-   Mature webhook delivery/retry controls and customer-facing
    observability.
-   Advanced agency and multi-client workflows.
-   Richer analytics and campaign learning based on comparable,
    sufficiently reliable data.
-   Configurable approval chains and enterprise permission policies.
-   Advanced anomaly signals with explainable evidence and human review.
-   Multi-market support, currency and localisation expansion after
    Nigeria validation.
-   More sophisticated reward policies, audit exports, and
    compliance/retention controls.
-   Operational scaling and extraction of a service only when real load
    or independent deployment needs justify it.

V3 does not automatically mean AI, blockchain, a marketplace, or
microservices. Those need separate evidence and justification.

------------------------------------------------------------------------

## 3. Stack and architecture

### 3.1 Agreed core stack: Next.js only for the MVP

The MVP is one full-stack Next.js application. Do not create a separate backend service now. Keep domain logic modular inside the Next.js
codebase so a separate backend can be extracted later without rewriting
the product workflows.

| Layer | MVP choice | Responsibility |
|---|---|---|
| Full-stack application | Next.js App Router, React, TypeScript | Public site, authenticated business workspace, creator portal, server rendering and application logic |
| Server-side endpoints | Next.js Route Handlers under `/api/v1/...` | Authenticated reads/writes, tracking redirects, event ingestion, exports and health check |
| Mutations | Server Actions where they simplify first-party form workflows; Route Handlers for public/API-facing contracts | Validated form submissions and predictable API behavior |
| Database | PostgreSQL | Transactional records, campaign state, event ledger, reward records and audit history |
| ORM and migrations | Prisma ORM + Prisma Migrate | Typed database access and versioned schema changes |
| Validation | Zod | Runtime validation for requests, environment variables and form inputs; share schemas where practical |
| Authentication | One selected auth provider or a carefully implemented session approach | Identity; server code still enforces workspace and resource permissions |
| Background work | Synchronous processing initially; add a queue only when retries or scheduled work require it | Keep the MVP deployable without Redis or a separate worker |
| File storage | S3-compatible object storage when evidence uploads are introduced | Private evidence files and access-controlled assets |
| API contract | Stable `/api/v1` Route Handler contract, documented in `docs/API.md` | Consistent client/server boundary and future extraction seam |
| Testing | TypeScript unit/integration tests plus Playwright end-to-end tests | Domain correctness, permission boundaries and complete user journeys |
| Deployment | One Next.js deployment plus managed PostgreSQL, secrets, backups, staging and production environments | Reliable delivery and recovery |
| Observability | Structured server logs, error monitoring and request/correlation IDs | Debugging and operational visibility |

**Why this is the MVP choice:** one language, one application deployment,
one validation approach, and one codebase reduce integration overhead
while the product is being validated. Do not add a Python API, Redis,
worker service, or microservices to the MVP by default.

**Future extraction rule:** preserve clear domain modules and keep HTTP
handlers thin. If/when the team switches to a separate backend in a later
phase, the existing `/api/v1` contracts and domain tests become the
migration boundary. That future backend technology is not part of the
MVP stack and should be selected deliberately at that time.

### 3.2 Single-app architecture and folder structure

Use one Next.js deployable application with explicit domain modules. Do
not split it into a separate API application for the MVP.

```text
creatorpay/
├── prisma/
│   ├── schema.prisma                 # PostgreSQL data model
│   └── migrations/                   # Versioned schema changes
├── public/                           # Static assets
├── src/
│   ├── app/
│   │   ├── (marketing)/              # Landing, how-it-works, FAQ
│   │   ├── (auth)/                   # Sign-in, sign-up, onboarding
│   │   ├── (business)/               # Business workspace screens
│   │   ├── (creator)/                # Creator portal screens
│   │   ├── api/v1/
│   │   │   ├── me/route.ts
│   │   │   ├── workspaces/route.ts
│   │   │   ├── campaigns/route.ts
│   │   │   ├── invitations/route.ts
│   │   │   ├── submissions/route.ts
│   │   │   ├── events/route.ts
│   │   │   ├── rewards/route.ts
│   │   │   ├── settlements/route.ts
│   │   │   └── .../route.ts          # Other documented endpoints
│   │   ├── r/[token]/route.ts        # Tracking redirect; record click safely
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                       # Reusable accessible primitives
│   │   ├── layout/
│   │   ├── campaigns/
│   │   ├── submissions/
│   │   ├── analytics/
│   │   └── rewards/
│   ├── modules/
│   │   ├── identity/
│   │   ├── workspaces/
│   │   ├── campaigns/
│   │   ├── creators/
│   │   ├── participation/
│   │   ├── deliverables/
│   │   ├── tracking/
│   │   ├── events/
│   │   ├── rewards/
│   │   ├── settlements/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   └── audit/
│   ├── lib/
│   │   ├── db.ts                     # Prisma client
│   │   ├── auth.ts                   # Session/auth integration
│   │   ├── permissions.ts            # Workspace/resource checks
│   │   ├── errors.ts                 # Consistent API errors
│   │   ├── logging.ts                # Structured logs/request IDs
│   │   ├── money.ts                  # Decimal-safe money helpers
│   │   └── validation/               # Shared Zod schemas
│   ├── actions/                      # Server Actions for first-party mutations
│   ├── types/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── docs/
│   ├── Build Plan.md
│   ├── API.md
│   └── demo-runbook.md
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

Keep domain code independent of page components. Route Handlers and Server
Actions should authenticate the request, validate input, call a domain
service, and return a typed result. Domain services own business rules
and transaction boundaries; Prisma access should not be scattered across
UI components.

A useful module pattern is:

```text
modules/campaigns/
├── schema.ts        # Zod input/output schemas
├── service.ts       # Domain operations and transaction boundaries
├── repository.ts    # Database queries if useful for complexity/testing
├── types.ts         # Domain types
└── service.test.ts
```

Do not create empty layers solely to match a diagram. Keep routes thin
and put business rules in testable module services.

### 3.3 Request flow

``` text
Browser
  → Next.js page/component
  → typed client or Server Action
  → Next.js Route Handler / server-side action
  → authentication + resource permission check
  → domain module service / transaction
  → Prisma
  → PostgreSQL
  → response DTO
  → UI updates from server response
```

For a tracked link:

``` text
Visitor opens /r/{opaque_token}
  → token lookup and enabled/campaign-state check
  → safe destination validation
  → click event recorded (or safely queued)
  → HTTP redirect to the approved destination
```

For a conversion event:

``` text
Authenticated business integration/test tool
  → validate source, schema, event type and idempotency
  → persist event with provenance
  → apply campaign attribution window and eligibility rules
  → mark verified/eligible or route to review
  → reward calculation can consume only eligible evidence
  → audit record + visible status
```

For reward calculation:

``` text
Versioned campaign terms + eligible events + approved submissions
  → deterministic calculation service
  → calculation snapshot and line items stored
  → business reviews and approves
  → settlement status remains separate from reward entitlement
```

### 3.4 Domain boundaries and invariants

-   **Identity/workspaces:** every protected request is scoped to a user
    and authorised workspace.
-   **Campaigns/terms:** terms are validated before publication;
    acceptance records point to a specific immutable term version.
-   **Participation:** no active participation or live reward link
    before required acceptance.
-   **Submissions:** content approval and conversion verification are
    separate workflows.
-   **Tracking:** opaque tokens, approved destinations, abuse limits,
    and no open redirect.
-   **Events:** source provenance, idempotency, explicit statuses,
    attribution-window checks, and review reason.
-   **Rewards:** decimal-safe amounts, deterministic calculation, caps,
    rule version, event inputs, and auditable adjustment history.
-   **Settlement:** reward approved is not the same as paid; V1
    settlement is manually recorded and labelled honestly.
-   **Analytics:** metrics must derive from persisted records; never
    fabricate ROI or claim sales from click counts.
-   **Audit:** important decisions and money-related state changes
    record actor, timestamp, action, and relevant before/after
    references.

------------------------------------------------------------------------

## 4. MVP data model

Use UUIDs or another non-guessable identifier for public-facing
resources. Monetary values must use PostgreSQL `NUMERIC` and a decimal-safe TypeScript representation (such as Prisma Decimal), not JavaScript binary floating-point arithmetic. Store timestamps in UTC and display
localised times in the UI.

### Core tables

  -----------------------------------------------------------------------
  Table                               Important fields / purpose
  ----------------------------------- -----------------------------------
  `users`                             `id`, auth-provider subject, email,
                                      display name, created/updated
                                      timestamps

  `workspaces`                        `id`, name, type (`business`
                                      initially), owner, timezone,
                                      currency default, created timestamp

  `workspace_memberships`             `workspace_id`, `user_id`, role;
                                      unique workspace/user

  `creator_profiles`                  `user_id`, display name, bio,
                                      social links, niche/platform
                                      fields; self-reported data labelled
                                      accordingly

  `campaigns`                         workspace, name, summary,
                                      objective, destination URL, status,
                                      start/end dates, attribution
                                      window, currency, created by

  `campaign_term_versions`            campaign, version, serialised
                                      validated terms, created by/time;
                                      immutable after
                                      publication/acceptance

  `deliverable_requirements`          campaign, name/type, description,
                                      quantity, due date, required
                                      evidence

  `reward_rules`                      campaign/term version, reward type,
                                      amount/unit, cap, conditions,
                                      currency

  `campaign_participants`             campaign, creator, state, accepted
                                      term version, accepted timestamp,
                                      invite source

  `invitations`                       campaign, creator/email, opaque
                                      token hash, status, expiry, created
                                      by

  `submissions`                       campaign, participant, requirement,
                                      evidence URL/file reference, note,
                                      status, reviewer, review note,
                                      timestamps

  `tracking_links`                    campaign, participant, opaque token
                                      hash/token, destination, enabled
                                      state, created timestamp

  `click_events`                      tracking link, occurred/received
                                      timestamp, coarse privacy-conscious
                                      metadata, validity status; no
                                      unnecessary personal identity

  `conversion_events`                 campaign, external ID/idempotency
                                      key, event type, event
                                      time/received time, source,
                                      value/currency if needed,
                                      verification status, eligibility
                                      status, reason

  `attribution_records`               event, selected participant/link,
                                      model, window, supporting click,
                                      decision timestamp

  `reward_calculations`               campaign, participant, rule/terms
                                      version, total, currency,
                                      calculation status, input snapshot,
                                      calculated by/time

  `reward_line_items`                 calculation, component type, source
                                      submission/event, quantity, unit
                                      amount, line total, explanation

  `reward_adjustments`                reward, amount delta, reason,
                                      actor, timestamp; never silently
                                      overwrite history

  `settlements`                       reward, status, amount, method
                                      label, reference, recorded by/time,
                                      note; clearly manual in V1

  `audit_events`                      actor, workspace, object type/id,
                                      action, timestamp, safe structured
                                      metadata

  `notifications`                     recipient, type, title/body, read
                                      state, created timestamp

  `integration_credentials`           workspace, hashed secret/key ID,
                                      scopes, revoked timestamp; V1 may
                                      use one workspace API credential
                                      path for demo/test event ingestion
  -----------------------------------------------------------------------

### Key database constraints

-   Unique `(workspace_id, user_id)` membership.
-   Unique `(campaign_id, creator_id)` participation unless the domain
    later explicitly supports separate participation rounds.
-   Unique external event ID within the appropriate source/workspace
    scope.
-   Unique idempotency key for reward calculation/settlement operations
    where applicable.
-   Foreign keys from reward line items to their source
    events/submissions when present.
-   Campaign terms versions cannot be silently edited after acceptance.
-   Reward totals are reproducible from line items and stored
    calculation inputs.
-   Tenant scoping is applied in queries and checked in service
    functions.
-   Avoid storing raw integration secrets. Return secret material only
    at creation if using API keys.

The schema should be implemented through migrations, not only ORM
auto-create on startup.

------------------------------------------------------------------------

## 5. API contract and endpoints

All endpoints below are proposed MVP interfaces, not existing routes.
Prefix application routes with `/v1`. Use consistent JSON schemas,
validation errors, pagination for lists, request IDs, and
authentication/authorization. Prefer explicit state-transition actions
over arbitrary status patches.

### 5.1 Health and identity

  -----------------------------------------------------------------------------------
  Method                  Path                                Purpose
  ----------------------- ----------------------------------- -----------------------
  `GET`                   `/health/live`                      Process liveness

  `GET`                   `/health/ready`                     Readiness including
                                                              database connectivity

  `GET`                   `/api/v1/me`                            Current user/profile

  `POST`                  `/api/v1/workspaces`                    Create business
                                                              workspace during
                                                              onboarding

  `GET`                   `/api/v1/workspaces/current`            Current workspace and
                                                              role

  `PATCH`                 `/api/v1/workspaces/current`            Update allowed
                                                              workspace profile
                                                              fields

  `GET`                   `/api/v1/workspaces/current/members`    List authorised members

  `GET`                   `/api/v1/workspaces/current/activity`   Recent workspace audit
                                                              activity
  -----------------------------------------------------------------------------------

Authentication sign-in/sign-up should be handled by the selected
authentication provider or implemented server-side if that is the chosen
design. Keep authentication in one selected provider/session implementation; do not create duplicate authentication logic. Next.js server code must validate the authenticated identity and still
check resource permissions for every resource operation.

### 5.2 Campaign lifecycle

  ----------------------------------------------------------------------------------------------
  Method                  Path                                           Purpose
  ----------------------- ---------------------------------------------- -----------------------
  `POST`                  `/api/v1/campaigns`                                Create a draft

  `GET`                   `/api/v1/campaigns`                                List workspace
                                                                         campaigns with
                                                                         filters/pagination

  `GET`                   `/api/v1/campaigns/{campaign_id}`                  Campaign detail and
                                                                         current status

  `PATCH`                 `/api/v1/campaigns/{campaign_id}`                  Edit permitted fields
                                                                         while draft or under
                                                                         policy

  `POST`                  `/api/v1/campaigns/{campaign_id}/validate`         Return missing/invalid
                                                                         configuration

  `POST`                  `/api/v1/campaigns/{campaign_id}/publish`          Validate and publish

  `POST`                  `/api/v1/campaigns/{campaign_id}/pause`            Pause eligible
                                                                         operations

  `POST`                  `/api/v1/campaigns/{campaign_id}/resume`           Resume

  `POST`                  `/api/v1/campaigns/{campaign_id}/close`            Close new activity
                                                                         under campaign policy

  `POST`                  `/api/v1/campaigns/{campaign_id}/archive`          Archive after
                                                                         operations are complete

  `GET`                   `/api/v1/campaigns/{campaign_id}/terms/versions`   List terms versions

  `GET`                   `/api/v1/campaigns/{campaign_id}/analytics`        Campaign summary
                                                                         metrics

  `GET`                   `/api/v1/campaigns/{campaign_id}/report.csv`       Download authorised
                                                                         report
  ----------------------------------------------------------------------------------------------

Campaign creation should accept objective, description, destination,
dates, deliverables, attribution window, reward model, currency, and any
required verification settings. Validate URLs and dates. Do not publish
a campaign with missing reward/verification configuration.

### 5.3 Creator invitations and participation

  --------------------------------------------------------------------------------------------
  Method                  Path                                         Purpose
  ----------------------- -------------------------------------------- -----------------------
  `POST`                  `/api/v1/campaigns/{campaign_id}/invitations`    Invite one
                                                                       creator/email

  `GET`                   `/api/v1/campaigns/{campaign_id}/participants`   List participants and
                                                                       states

  `GET`                   `/api/v1/invitations/{token}`                    Read invitation details
                                                                       safely

  `POST`                  `/api/v1/invitations/{token}/accept`             Accept after
                                                                       authentication and
                                                                       terms review

  `POST`                  `/api/v1/invitations/{token}/decline`            Decline invitation

  `GET`                   `/api/v1/creators/me/profile`                    Creator profile

  `PATCH`                 `/api/v1/creators/me/profile`                    Update creator profile

  `GET`                   `/api/v1/creators/me/campaigns`                  Creator's
                                                                       accepted/pending
                                                                       campaigns

  `GET`                   `/api/v1/creators/me/campaigns/{campaign_id}`    Own campaign brief,
                                                                       obligations and
                                                                       statuses

  `GET`                   `/api/v1/creators/me/overview`                   Creator dashboard
                                                                       summary
  --------------------------------------------------------------------------------------------

Do not reveal a creator's private profile or performance data to
unrelated users. Invitation tokens should be high entropy, expire, and
be stored as hashes where practical.

### 5.4 Deliverables and submissions

  ----------------------------------------------------------------------------------------------------
  Method                  Path                                                 Purpose
  ----------------------- ---------------------------------------------------- -----------------------
  `GET`                   `/api/v1/campaigns/{campaign_id}/deliverables`           List requirements

  `POST`                  `/api/v1/campaigns/{campaign_id}/submissions`            Submit evidence for a
                                                                               requirement

  `GET`                   `/api/v1/campaigns/{campaign_id}/submissions`            Business review queue

  `GET`                   `/api/v1/submissions/{submission_id}`                    Detail subject to
                                                                               permission

  `POST`                  `/api/v1/submissions/{submission_id}/request-revision`   Request correction with
                                                                               reason

  `POST`                  `/api/v1/submissions/{submission_id}/approve`            Approve deliverable

  `POST`                  `/api/v1/submissions/{submission_id}/reject`             Reject with reason

  `GET`                   `/api/v1/creators/me/submissions`                        Creator's submission
                                                                               history
  ----------------------------------------------------------------------------------------------------

A submission endpoint must verify that the creator is an active
participant in that campaign and that the requirement belongs to the
same campaign.

### 5.5 Tracking links and click analytics

  ---------------------------------------------------------------------------------------------------------
  Method                  Path                                                      Purpose
  ----------------------- --------------------------------------------------------- -----------------------
  `POST`                  `/api/v1/campaigns/{campaign_id}/tracking-links`              Issue
                                                                                    participant-specific
                                                                                    link

  `GET`                   `/api/v1/creators/me/campaigns/{campaign_id}/tracking-link`   Creator gets own link

  `POST`                  `/api/v1/tracking-links/{link_id}/disable`                    Disable a link with
                                                                                    permission check

  `GET`                   `/r/{opaque_token}`                                       Record eligible click
                                                                                    and redirect

  `GET`                   `/api/v1/campaigns/{campaign_id}/clicks`                      Campaign click
                                                                                    summary/list as
                                                                                    appropriate

  `GET`                   `/api/v1/creators/me/campaigns/{campaign_id}/analytics`       Creator's own
                                                                                    click/event metrics
  ---------------------------------------------------------------------------------------------------------

The redirect must only use the destination saved and validated by the
platform. Do not accept arbitrary redirect destinations from the query
string. Rate-limit abuse and distinguish raw from eligible clicks if
filtering is implemented.

### 5.6 Conversion events and verification

  ---------------------------------------------------------------------------------------
  Method                  Path                                    Purpose
  ----------------------- --------------------------------------- -----------------------
  `POST`                  `/api/v1/events`                            Ingest authenticated
                                                                  event with idempotency

  `GET`                   `/api/v1/events/{event_id}`                 Event detail/status for
                                                                  authorised users

  `GET`                   `/api/v1/campaigns/{campaign_id}/events`    Campaign event review
                                                                  queue

  `POST`                  `/api/v1/events/{event_id}/verify`          Record verification
                                                                  decision

  `POST`                  `/api/v1/events/{event_id}/reject`          Reject with reason

  `POST`                  `/api/v1/events/{event_id}/mark-eligible`   Explicit eligibility
                                                                  decision where policy
                                                                  requires review

  `POST`                  `/api/v1/integrations/test-events`          Submit clearly labelled
                                                                  test event

  `GET`                   `/api/v1/integrations/events`               Integration event
                                                                  history
  ---------------------------------------------------------------------------------------

Minimum event fields: source/external event ID or idempotency key,
campaign reference, event type, event timestamp, and supported
attribution metadata. Validate source permissions, campaign state,
allowed event type, duplicate keys, and attribution window. Test events
must never enter live reward calculations.

### 5.7 Reward calculation and settlement records

  -------------------------------------------------------------------------------------------------
  Method                  Path                                              Purpose
  ----------------------- ------------------------------------------------- -----------------------
  `POST`                  `/api/v1/campaigns/{campaign_id}/rewards/calculate`   Calculate participant
                                                                            rewards from eligible
                                                                            evidence

  `GET`                   `/api/v1/campaigns/{campaign_id}/rewards`             Business reward ledger

  `GET`                   `/api/v1/creators/me/rewards`                         Creator's own rewards

  `GET`                   `/api/v1/rewards/{reward_id}`                         Reward detail and
                                                                            calculation breakdown

  `POST`                  `/api/v1/rewards/{reward_id}/approve`                 Authorised business
                                                                            approval

  `POST`                  `/api/v1/rewards/{reward_id}/dispute`                 Record dispute with
                                                                            reason

  `POST`                  `/api/v1/rewards/{reward_id}/settlements/manual`      Record manual
                                                                            settlement
                                                                            status/reference

  `GET`                   `/api/v1/rewards/{reward_id}/settlements`             Settlement history
  -------------------------------------------------------------------------------------------------

Reward calculation must be deterministic and safe to retry. Store a
snapshot of the rule version, eligible inputs, line items, caps,
currency, and rounding result. Creator-facing APIs must never approve
rewards or change campaign rules.

### 5.8 Exports, notifications, audit

  --------------------------------------------------------------------------------------------
  Method                  Path                                         Purpose
  ----------------------- -------------------------------------------- -----------------------
  `GET`                   `/api/v1/campaigns/{campaign_id}/report.csv`     Campaign metrics export

  `GET`                   `/api/v1/campaigns/{campaign_id}/rewards.csv`    Reward ledger export

  `GET`                   `/api/v1/notifications`                          List current user's
                                                                       notifications

  `POST`                  `/api/v1/notifications/{notification_id}/read`   Mark read

  `GET`                   `/api/v1/workspaces/current/activity`            Audit/activity timeline
  --------------------------------------------------------------------------------------------

### 5.9 Endpoint conventions

-   `401` unauthenticated; `403` authenticated but not permitted; `404`
    unknown or deliberately hidden resource; `409` conflicting
    state/idempotency conflict; `422` schema/business validation
    failure; `429` rate limited.
-   Use a stable error shape such as
    `{ "error": { "code": "...", "message": "...", "details": {}, "request_id": "..." } }`.
-   Paginate large lists. Do not return unbounded event/submission
    histories.
-   Accept an `Idempotency-Key` for operations where retrying could
    create duplicate events, calculations, or settlement records.
-   Use transactions for state transitions and related audit writes.
-   Every endpoint must be covered by authentication and resource-scope
    tests.
-   Document the `/api/v1` Route Handler contract in `docs/API.md` and cover it with request/response tests. Keep this contract as the migration boundary if a separate backend is introduced later.

------------------------------------------------------------------------

## 6. Frontend: complete MVP screen inventory

The visual system should be polished and consistent, but design polish
must not substitute for working flows. Use a responsive application
shell, clear navigation, accessible forms, informative empty states,
loading states, error states, confirmation dialogs, and explicit status
labels.

### 6.1 Public marketing experience

1.  **Landing page**
    -   Hero: "Make creator marketing accountable."
    -   Supporting copy: "Know what your creators deliver, not just what
        they post."
    -   Primary CTA for businesses to start/create an account.
    -   Secondary CTA for creators to understand participation.
    -   Product workflow section: Define, Manage, Track, Verify,
        Calculate, Settle, Learn.
    -   Feature sections for business and creator benefits.
    -   Example campaign report with clearly labelled sample/demo data.
    -   FAQ and footer.
2.  **How it works**
    -   Business workflow and creator workflow shown separately.
3.  **For businesses**
    -   Campaign operations, evidence, reward transparency, reporting.
4.  **For creators**
    -   Clear terms, deliverables, tracking link, submissions, rewards.
5.  **FAQ**
    -   Explain tracking limitations, verified vs reported outcomes, and
        payout-status meaning honestly.
6.  **Sign in**
7.  **Create account**
8.  **Invitation acceptance entry**
    -   Token validation, sign-in/sign-up, then invitation detail.
9.  **Privacy/terms placeholders only if approved content exists**
    -   Do not invent legal guarantees or publish boilerplate as
        reviewed legal advice.

### 6.2 Shared authenticated screens and overlays

-   First-run onboarding: choose Business workspace or Creator profile
    based on account intent; creator invitation can route directly to
    creator flow.
-   Workspace setup: business name, basic profile, timezone/currency.
-   Global navigation/sidebar with active state and mobile navigation.
-   Profile menu and account settings.
-   Notification panel.
-   Search/filter controls only where backed by actual data.
-   Loading skeletons, error retry panels, no-data empty states,
    permission-denied states.
-   Confirmation modal for publish, pause, close, archive,
    approve/reject, and manual settlement recording.
-   Toast/inline feedback after successful actions.
-   Unsaved-changes warning for campaign editor.
-   Destructive action confirmation and required reason fields for
    rejection/adjustment.
-   No demo-only fake counters in normal user workspaces.

### 6.3 Business workspace screens

1.  **Business overview**
    -   Active/draft/closed campaign counts.
    -   Creator participation counts.
    -   Submissions awaiting review.
    -   Clicks and eligible events, with definitions.
    -   Calculated/approved/disputed/paid or manually settled reward
        totals.
    -   Recent activity and next actions.
2.  **Campaign list**
    -   Search, status filter, date filter if supported.
    -   Campaign name, objective, status, dates, creator count,
        click/event summary.
    -   Create campaign CTA.
3.  **Create campaign wizard**
    -   Step 1: basics and objective.
    -   Step 2: deliverables, formats, deadlines, evidence requirements.
    -   Step 3: destination and tracking/attribution window.
    -   Step 4: reward rules, currency, fixed/per-event/hybrid reward,
        caps.
    -   Step 5: preview terms and validate required fields.
    -   Save draft and publish actions.
    -   Back/continue navigation and field-level validation.
4.  **Campaign detail / command centre**
    -   Campaign state and actions.
    -   Summary metrics.
    -   Tabs/sections: Overview, Creators, Deliverables, Events,
        Rewards, Analytics, Terms/Activity.
    -   Clear outstanding tasks.
5.  **Campaign edit**
    -   Editable fields depend on state.
    -   Published/accepted terms must be versioned; no silent
        retroactive term changes.
6.  **Creator invitations/participants**
    -   Add creator by email or share invite.
    -   Participant list and statuses.
    -   Invitation expiry/resend controls where implemented.
7.  **Submission review queue**
    -   Filter by pending/revision/approved/rejected.
    -   Preview link/evidence, creator, requirement, submission time.
8.  **Submission detail/review panel**
    -   Evidence, creator note, requirement and deadline.
    -   Approve, request revision, reject with reason.
    -   Review history.
9.  **Event review queue**
    -   Received/reported/under review/verified/eligible/rejected
        states.
    -   Source, event type, timestamps, attributed participant,
        provenance.
    -   Verify/reject/mark eligible with reason where required.
10. **Rewards ledger**
    -   Creator, fixed fee, performance component, total, currency,
        calculation state, approval state, settlement state.
11. **Reward detail**
    -   Line-item breakdown, eligible events/submissions, rule version,
        cap, audit history.
    -   Calculate/recalculate action subject to policy.
    -   Approve and dispute handling.
12. **Manual settlement record modal/page**
    -   Amount, method label, reference, note, confirmation.
    -   Warning: this records an operator-entered status and is not a
        payment-provider confirmation.
13. **Analytics/reporting**
    -   Clicks vs verified/eligible conversions.
    -   Creator and campaign breakdowns.
    -   Cost per eligible outcome only when relevant inputs exist.
    -   Export CSV.
    -   No ROI/ROAS without reliable revenue and cost data.
14. **Activity/audit**
    -   Campaign edits, accepted terms, review decisions, reward
        calculations/approvals, settlement records.
15. **Business settings**
    -   Business profile, timezone/currency, account/profile settings.
16. **Creator directory within workspace**
    -   Only creators already invited/participating or known to that
        business in V1; not a global marketplace.
17. **Integration/test-event panel**
    -   MVP may be a minimal developer-facing screen or documented API
        tool to submit a labelled test event, view validation result and
        event status.

### 6.4 Creator portal screens

1.  **Creator overview**
    -   Active campaigns, pending deliverables, submissions needing
        revision, clicks, eligible event counts, rewards by status.
2.  **My campaigns**
    -   Invited, active, completed, declined or withdrawn campaigns.
3.  **Invitation/campaign terms**
    -   Business, objective, deliverables, deadline, reward structure,
        attribution window, evidence rules, cancellation/terms
        information.
    -   Accept/decline.
    -   Display the terms version being accepted.
4.  **Campaign workspace**
    -   Brief, checklist, deliverable requirements, deadline, tracking
        link, current submission status, performance summary, reward
        summary.
5.  **Tracking link panel**
    -   Copy link, destination preview, active/disabled status.
    -   Explain that link clicks do not prove a conversion.
6.  **Submit deliverable**
    -   Choose requirement, public content URL or supported evidence,
        optional note.
    -   Submission confirmation and timestamp.
7.  **Submission history/detail**
    -   Submitted evidence, review state, reviewer feedback, revision
        request and resubmission.
8.  **Analytics**
    -   Own click counts and attributable event statuses only.
    -   Label estimates/reported/unverified/verified/eligible
        distinctions.
9.  **Rewards**
    -   Fixed fee vs performance component.
    -   Calculation breakdown, pending review, approved, disputed,
        paid/manual settlement status.
10. **Reward detail**
    -   How the amount was calculated and which evidence was included.
11. **Creator profile**
    -   Name, bio, social handles/links, niche/platform fields.
    -   Self-reported information visibly labelled where relevant.
12. **Notifications**
    -   Invitation, submission review, reward approval, settlement
        updates.

### 6.5 Public consumer campaign experience

-   **Tracked redirect:** no CreatorPay account required. Record
    supported click and redirect to approved destination.
-   **Optional branded campaign landing page:** not required for the
    first MVP unless the pilot needs it. If included, show
    business/campaign information and a clear CTA. Do not create a
    consumer account requirement.
-   **Invalid/disabled link page:** helpful, safe response without
    leaking internal data.

### 6.6 Important modals and component states

-   Create/edit campaign: date picker, reward-rule builder,
    attribution-window selector, destination URL validation, terms
    preview.
-   Invite creator: email, invitation link, success/error state.
-   Accept terms: explicit checkbox/action and saved version.
-   Submission review: approve, request revision, reject with reason.
-   Event review: verify/reject/mark eligible with reason and source
    information.
-   Calculate rewards: preview affected participants, inputs, totals and
    caps before committing.
-   Approve reward: confirm authorised action.
-   Record settlement: explain manual status semantics; collect
    reference and note.
-   Pause/resume/close/archive campaign confirmations.
-   Export report: selected campaign and included metrics.
-   Global: loading, empty, validation error, server error, permission
    error, expired invitation, disabled tracking link, duplicate event,
    event pending review, and no attribution evidence.

------------------------------------------------------------------------

## 7. Product state machines

Implement state transitions explicitly in service functions. Do not
accept arbitrary client-provided status values.

### Campaign

`draft → published → paused ↔ published → closed → archived`

Policy can allow closing from published or paused. Archived campaigns
retain history and outstanding reward/settlement records. Closing does
not delete records.

### Participation

`invited → accepted/active` or `declined`; applications and review
states can be added when public applications ship. Active participation
requires acceptance of the current applicable terms.

### Submission

`submitted → under_review → approved | revision_requested | rejected`

A revision request can lead to a new submission/version or a
resubmission record. Preserve review history.

### Conversion event

`received → reported/under_review → verified → eligible`

Alternative terminal/revision paths include `rejected` and
`reversed/adjusted`. Verification and eligibility are distinct. Record
reasons and source provenance.

### Reward

`calculated → pending_review → approved → payable/manual settlement pending → settled/paid-status recorded`

Additional states include `disputed`, `payment_failed` in a future
provider-backed flow, and `adjusted/reversed`. In V1, avoid presenting
manual settlement as provider-confirmed payment.

------------------------------------------------------------------------

## 8. Security, correctness, and non-functional requirements

### Must-have for V1

-   Backend authorization on every private resource, not only hidden
    frontend buttons.
-   Tenant/workspace isolation tests.
-   Secure session/token handling and secret management.
-   Request validation and output schemas.
-   Rate limits for sign-in/invitation/tracking/event endpoints as
    appropriate.
-   Opaque tracking and invitation tokens; avoid exposing sequential
    internal IDs in public links.
-   Approved-destination validation and no open redirect vulnerability.
-   Idempotency for conversion events and reward/settlement operations.
-   Decimal-safe money arithmetic and explicit currency/rounding.
-   Immutable terms snapshots after acceptance; version changes are
    explicit.
-   Audit records for publish/pause/close, terms acceptance, submission
    decisions, event verification/eligibility, reward
    calculations/approval/adjustment, and settlement records.
-   File upload restrictions if uploads are enabled; private storage and
    authorised access.
-   UTC timestamps; display timezone clearly.
-   Paginated event/submission/audit lists.
-   Structured logs, request IDs, and actionable errors.
-   Database migrations, automated backups, and a tested restore
    procedure before real pilots.
-   Separate test and production environment variables/secrets.
-   Test events clearly marked and excluded from real rewards.
-   Clear status language: reported, verified, eligible, approved, and
    settled/paid are not synonyms.

### MVP testing requirements

**Unit tests** - Campaign publication validation. - Accepted
term-version persistence. - Attribution-window boundary cases. - Event
idempotency/duplicate handling. - Eligibility checks. - Fixed,
per-event, and hybrid reward calculation. - Currency rounding and
caps. - State-transition permissions. - CSV totals match stored records.

**Integration tests** - Database persistence and transactions. -
Cross-workspace access denied. - Invitation acceptance and participant
activation. - Redirect records click and only redirects to approved
destination. - Event ingestion returns existing event for a safe
idempotent retry. - Submission review updates creator-visible status. -
Reward approval is business-authorised. - Manual settlement creates
audit history without pretending provider confirmation.

**End-to-end tests** 1. Business creates and publishes a campaign. 2.
Creator accepts the invitation and terms. 3. Creator obtains a link and
submits a deliverable. 4. Visitor clicks the link. 5. Business reviews
the submission. 6. Event is ingested and reviewed. 7. Reward is
calculated and approved. 8. Creator sees the breakdown and status. 9.
Business records settlement and exports the report.

------------------------------------------------------------------------

## 9. Step-by-step build sequence: skeleton to polished MVP

Build by vertical slices. Each phase should leave the product runnable.
Do not build every backend module first and leave the UI disconnected
until the end.

### Phase 0 --- Lock decisions and repository skeleton

**Build** - Create repository and agreed folder structure. - Add
`README.md`, environment example files, formatting/linting, and basic
CI. - Choose authentication approach and document its frontend/backend
verification flow. - Confirm local development and deployment targets. -
Record unresolved policy choices: attribution default/window, manual
settlement language, test-event handling, and funding/provider
decisions.

**Done when** - A developer can clone, configure environment variables,
run the Next.js application and database, and reach the health endpoint. - No real secrets
are committed.

### Phase 1 --- Design system and clickable shell

**Build** - Define tokens for colour, typography, spacing, radii,
shadows, and responsive breakpoints. - Build buttons, inputs, selects,
date fields, badges, tables, cards, empty states, toasts, dialogs,
skeletons, and form errors. - Build public marketing layout and
authenticated business/creator shells. - Implement responsive
sidebar/navigation and role-aware navigation. - Use realistic sample
fixtures only in design/storybook or explicitly labelled demo mode.

**Done when** - Every planned screen has a clear route and visual
structure. - Core shared components have accessible states. - Navigation
works, but no one mistakes mocked values for live product metrics.

### Phase 2 --- Database, migrations, identity and workspace

**Build** - Set up PostgreSQL, Prisma schema/migrations, environment
settings, server logging, and a consistent API error format. - Implement authentication integration and
`GET /api/v1/me`. - Create workspace and membership model; create business
workspace during onboarding. - Add permission dependency/helper and
enforce workspace scope. - Build sign-up/sign-in/onboarding screens and
empty business overview.

**Done when** - Users can sign in, create a workspace, reload the page,
and see persisted workspace data. - A user cannot access another
workspace by changing an ID in a URL or request.

### Phase 3 --- Campaign creation and lifecycle

**Build** - Implement campaign and immutable term-version data model. -
Implement campaign draft CRUD, validation, preview, publish,
pause/resume/close. - Add deliverable requirements and MVP reward-rule
schema. - Build campaign list, multi-step creation wizard, campaign
detail and edit screens. - Add audit entries for meaningful campaign
transitions.

**Done when** - A business can create a meaningful campaign with terms,
schedule, destination, deliverables, attribution window and reward
rule. - Invalid campaign configuration cannot be published. -
Accepted/published terms are versioned rather than silently overwritten.

### Phase 4 --- Creator invitation and acceptance

**Build** - Implement creator profile and campaign participation. -
Implement secure invitation tokens and invitation detail. - Implement
accept/decline and accepted term version recording. - Build creator
account/profile, invitation screen, my campaigns and campaign
workspace. - Generate a tracking link only after participation is
eligible and terms are accepted.

**Done when** - A business can invite a creator it already knows. - The
creator can read and accept the exact terms, and both sides see
consistent status. - A creator cannot accept another creator's
invitation or read another creator's private records.

### Phase 5 --- Deliverables and review loop

**Build** - Implement submission records, evidence URL validation,
review decisions and revision history. - Build creator
submit-deliverable and submission-history screens. - Build business
review queue and submission detail/review controls. - Add in-app
notifications or visible activity for status changes.

**Done when** - Creator submits a deliverable, business requests a
revision or approves it, and creator sees the result. - Content approval
does not automatically mark conversion events verified.

### Phase 6 --- Tracking links and clicks

**Build** - Implement high-entropy opaque link tokens, enabled state and
approved destination. - Implement redirect endpoint and click event
storage. - Build creator link panel and click analytics. - Build
business campaign click summary. - Add basic abuse/rate limits and safe
redirect tests.

**Done when** - Each active creator participant has their own link. -
Opening the link records a click and redirects to the approved
destination. - Disabled/invalid links fail safely and arbitrary
query-string destinations cannot redirect visitors elsewhere. -
Analytics label the metric as clicks, not sales.

### Phase 7 --- Event ingestion, attribution and verification

**Build** - Define the minimal conversion event schema and source
authentication. - Implement idempotency and duplicate detection. -
Implement test-event path with unmistakable test label. - Implement
initial attribution policy and window checks; keep unsupported events
unattributed. - Implement verification/eligibility states and business
review actions. - Build event queue/detail screens and event status
visibility.

**Done when** - A test/live event can be ingested with source
provenance. - A duplicate retry cannot create another event or reward. -
The system records why an event is eligible, ineligible, or under
review. - Test events never contribute to real rewards.

### Phase 8 --- Deterministic rewards and manual settlement ledger

**Build** - Implement a pure reward calculation service for fixed,
per-eligible-event and hybrid models. - Store calculation snapshot, rule
version, line items, caps and source evidence. - Implement calculation
preview, commit, approval and dispute entry. - Implement manual
settlement records with clear status language and audit history. - Build
business rewards ledger/detail and creator reward screens. - Use
`Decimal` and database `NUMERIC` consistently.

**Done when** - The same inputs and rule version produce the same
calculation. - Reward line items can be explained to the creator. -
Re-running a calculation cannot silently duplicate obligations. -
Approval and settlement are separate, permissioned actions. - The app
never claims that a manually entered record is a provider-confirmed
transfer.

### Phase 9 --- Analytics, reports, audit and demo data

**Build** - Build database-backed business overview and creator
overview. - Add campaign performance summaries and creator-level
metrics. - Add CSV campaign report and reward ledger export. - Add
audit/activity timeline and consistent status labels. - Create a seeded
demo workspace with a realistic campaign, two or more creators,
deliverables, click records, test/eligible events, reward breakdowns,
and activity history. - Provide a demo runbook and reset script.

**Done when** - Dashboard totals reconcile with detail pages and
exports. - Every seeded metric is generated from seeded records, not
hardcoded UI constants. - Demo data is clearly labelled and test events
cannot leak into live reward calculations.

### Phase 10 --- Product polish and pilot readiness

**Build** - Responsive QA on common desktop/mobile widths. -
Accessibility and keyboard checks for forms, dialogs and tables. -
Loading/empty/error states on all core pages. - Input validation,
confirmation dialogs and unsaved-change handling. - API integration
tests, end-to-end happy path and permission regression tests. - Error
monitoring, database backup and restore check, deployment pipeline and
staging. - Document API, environment setup, seed/reset process and known
limitations. - Conduct an internal demo using a fresh account, not only
the developer's preloaded session.

**Done when** - A fresh account can complete the core flow without
developer intervention. - Critical tests pass and no known cross-tenant
access issue remains. - The demo can be reset and repeated reliably. -
Product copy accurately describes tracking limitations and settlement
status.

### Phase 11 --- Pilot validation and V2 prioritisation

**Build / operational work** - Recruit 3--5 design partners and run real
campaigns only with consent and clear terms. - Record what data each
business can actually provide. - Measure submission-review time,
reporting time, event evidence quality, reward corrections/disputes, and
campaign repeat intent. - Identify the most frequent manual steps and
most requested integrations. - Choose V2 work from observed pain and
willingness to pay, not assumptions.

**Done when** - Pilot results distinguish product capability from
unsupported tracking. - V2 scope has evidence and a named owner. -
Pricing/provider/funding choices are revisited with customer and
legal/provider input.

------------------------------------------------------------------------

## 10. End-to-end demo script

Use a demo workspace and clearly labelled test data.

1.  Open the landing page and explain CreatorPay's accountability
    promise.
2.  Sign in as a business and open the overview.
3.  Create a campaign: "Lagos Product Launch", objective
    "registrations", a defined content deliverable, a sample
    destination, a 7-day example attribution window, and a fixed fee
    plus a reward per eligible registration.
4.  Preview and publish the terms.
5.  Invite a demo creator.
6.  Switch to the creator account; inspect terms and accept.
7.  Copy the generated tracking link.
8.  Open it in a private browser; show the redirect and click count.
9.  Submit a content URL for the required deliverable.
10. Return to business; request revision, then have creator resubmit;
    approve the final submission.
11. In the integration/test-event panel or API docs, send a labelled
    test event, then demonstrate duplicate idempotency. Explain that
    test events do not enter live reward totals.
12. Submit a non-test demo event through the controlled demo fixture or
    authenticated event endpoint and show source/status.
13. Verify/mark eligible under the campaign rules.
14. Calculate rewards and show each line item, input event, fixed fee,
    cap and total.
15. Approve the reward.
16. Switch to creator; show the same reward breakdown and correct
    status.
17. Record a manual settlement reference as the business and explicitly
    explain it is a manual record, not an automatic provider
    confirmation.
18. Open analytics and export the campaign report.
19. Open activity history and trace terms, submission review, event
    decision, reward approval and settlement record.

The demo should show realistic connected data and a complete loop. Never
imply a test event is a real customer conversion or that a click proves
a sale.

------------------------------------------------------------------------

## 11. Release gates and definition of done

### Functional gate

-   The core journey works from a fresh business account through creator
    participation, evidence, event review, reward approval, settlement
    record and report.
-   Every primary CTA has a real result or a clearly labelled
    future/disabled state.
-   No critical screen is only a static mock.

### Data integrity gate

-   Campaign terms accepted by a creator can be reconstructed.
-   Reward totals reconcile to line items and eligible evidence.
-   Duplicate requests do not create duplicate events, rewards or
    settlement records.
-   Manual corrections preserve history.

### Security gate

-   Tenant isolation and role checks are tested.
-   Invitation/tracking tokens are not guessable.
-   Redirect destination is validated.
-   Secrets are absent from source control and logs.
-   Test events cannot earn live rewards.

### UX gate

-   Every data list has loading, empty, error and populated states.
-   Status labels are consistent between business and creator views.
-   Forms explain validation errors.
-   Core workflow is usable on mobile-width browsers.
-   The interface distinguishes reported, verified, eligible, approved,
    and settled/paid states.

### Operations gate

-   Staging and production settings are separated.
-   Migrations run reproducibly.
-   Backup and restore are documented/tested.
-   Logs and errors are actionable.
-   A fresh demo can be seeded/reset.

------------------------------------------------------------------------

## 12. Explicitly unresolved decisions

Do not silently treat these as final product decisions:

1.  **Attribution default/window:** the product definition proposes last
    eligible tracked creator click within a configured window as a
    candidate default, but says it must be validated. For MVP, make the
    policy explicit in campaign terms and implement only one selected
    model.
2.  **Funding policy:** fund before publication versus publish before
    funding with settlement blocked remains open. Since provider/funding
    is not part of the MVP, label funding as outside the
    manual-settlement demo rather than implying funds are held.
3.  **Payment provider and custody:** not selected. V1 records
    settlement status manually and must not claim escrow or guaranteed
    payout.
4.  **Social platform access:** do not assume APIs expose all desired
    metrics or permissions. V1 accepts public URLs and supported
    evidence.
5.  **Initial customer segment and pricing:** validate with businesses
    and agencies. Do not hardcode speculative prices into public pages.
6.  **Public creator applications:** V1 can use invited creators. Add
    discoverable campaigns when validated.
7.  **Data retention/privacy:** define retention and privacy notices
    with appropriate review before live customer tracking.
8.  **Notification channel:** start with in-app/status notifications;
    email delivery can be added when provider and operational handling
    are ready.
9.  **Agency support:** V1 is single business workspace focused; full
    client separation and agency cross-client views belong in V2.
10. **Redis/background worker:** add when asynchronous tasks need
    reliable retries. Do not introduce complexity without a workload.

------------------------------------------------------------------------

## 13. Implementation rules for the coding agent/team

1.  Read `CreatorPay_Product.md` before implementing a feature; it wins
    over assumptions in this plan.
2.  Implement one vertical slice at a time: schema → service → endpoint
    → UI → tests.
3.  Keep the API as the authority for permissions, state transitions,
    attribution and reward logic.
4.  Never calculate reward totals independently in frontend components.
5.  Use real persisted data for dashboards. Seeded demo data is
    acceptable only when it is stored and labelled as demo data.
6.  Do not use mock API responses to claim a feature is implemented.
7.  Avoid premature abstractions and microservices; keep clear domain
    boundaries in the modular monolith.
8.  Keep event source and verification provenance visible.
9.  Preserve accepted terms and reward calculation history.
10. If a requirement conflicts with the product source, stop and
    identify the conflict rather than silently redefining the product.
11. For each phase, report: files changed, migrations added, endpoints
    added, screens completed, tests run, known gaps, and exact manual
    verification steps.
12. Do not mark a phase complete based on screenshots alone. Demonstrate
    the action and persisted result.

## 14. Final MVP bar

CreatorPay V1 is ready for a pilot/demo when a business can run a
campaign using creators it already knows, the creator can accept clear
terms and submit work, tracked links record clicks without overstating
conversions, supported events can be reviewed and attributed under
explicit rules, rewards are calculated transparently from eligible
evidence, and both sides can see the correct reward and settlement
status with a traceable history.

The aim is not to ship the largest possible feature list. It is to ship
the smallest complete product that proves CreatorPay's central promise:
**one accountable record from campaign agreement to deliverables,
evidence, reward calculation, and settlement status.**
