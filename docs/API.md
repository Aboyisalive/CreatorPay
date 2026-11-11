# CreatorPay API

Base URL: `/api/v1`. All endpoints return JSON unless noted (CSV exports,
tracking redirect). Money is serialized as **strings of minor units**
(kobo for NGN), e.g. `"150000"` = ₦1,500.00.

## Conventions

- **Auth**: session cookie `cp_session` (httpOnly, set by `/auth/login`).
  API endpoints return `401` without a valid session; the page-level
  proxy redirects unauthenticated `/dashboard` and `/creator` visits to
  `/login`.
- **Errors** follow one shape:

  ```json
  {
    "error": {
      "code": "forbidden",
      "message": "…",
      "details": [{ "path": "…", "message": "…" }],
      "request_id": "…"
    }
  }
  ```

  Codes: `unauthorized` (401), `forbidden` (403), `not_found` (404),
  `conflict` (409), `validation_error` (422), `bad_request` (400),
  `internal_error` (500).
- **Pagination**: `?take=&skip=` on list endpoints; responses include
  `total`, `take`, `skip`.
- **Tenant isolation**: every workspace-scoped route resolves the caller's
  membership for the resource's workspace; members of other workspaces get
  `403` with no data leak. Creators can only read their own profile,
  submissions, rewards and campaign briefs.
- **Idempotency**: conversion events are unique on
  `(campaignId, externalEventId)`; replays return the original event with
  `duplicate: true`.

## Health

| Method | Path             | Auth | Purpose                    |
| ------ | ---------------- | ---- | -------------------------- |
| GET    | `/health/live`   | none | Process liveness           |
| GET    | `/health/ready`  | none | Readiness + DB connectivity (503 when down) |

## Auth and identity

| Method | Path                      | Roles        | Purpose |
| ------ | ------------------------- | ------------ | ------- |
| POST   | `/api/v1/auth/register`   | none         | Create BUSINESS (creates workspace) or CREATOR account |
| POST   | `/api/v1/auth/login`      | none         | Start session |
| POST   | `/api/v1/auth/logout`     | any          | End session |
| GET    | `/api/v1/me`              | any          | Current user, memberships, creator profile |
| POST   | `/api/v1/workspaces`      | no workspace | Create a business workspace (one per account in MVP) |
| GET    | `/api/v1/workspaces/current` | any       | Current workspace + role |
| PATCH  | `/api/v1/workspaces/current` | managers  | Update name/currency |
| GET    | `/api/v1/workspaces/current/members` | any | List authorised members |
| GET    | `/api/v1/workspaces/current/activity` | any | Paginated audit timeline |

## Campaigns

| Method | Path                                 | Roles     | Purpose |
| ------ | ------------------------------------ | --------- | ------- |
| POST   | `/api/v1/campaigns`                  | managers  | Create draft with terms + reward rules |
| GET    | `/api/v1/campaigns`                  | any       | List workspace campaigns |
| GET    | `/api/v1/campaigns/{id}`             | any       | Campaign detail, terms, stats |
| PATCH  | `/api/v1/campaigns/{id}`             | managers  | Edit draft terms (creates new version) |
| POST   | `/api/v1/campaigns/{id}/validate`    | managers  | Publish-readiness issues |
| POST   | `/api/v1/campaigns/{id}/publish`     | managers  | Lock current term version, open participation |
| POST   | `/api/v1/campaigns/{id}/pause`       | managers  | Pause click recording |
| POST   | `/api/v1/campaigns/{id}/resume`      | managers  | Resume |
| POST   | `/api/v1/campaigns/{id}/close`       | managers  | Close to new activity |
| POST   | `/api/v1/campaigns/{id}/archive`     | managers  | Archive a draft/closed campaign |
| GET    | `/api/v1/campaigns/{id}/terms/versions` | any    | Term version history + acceptance counts |
| GET    | `/api/v1/campaigns/{id}/participants`  | any     | Participants, link status, submission counts |
| GET    | `/api/v1/campaigns/{id}/analytics`     | any     | Aggregate clicks/events/rewards by status |
| GET    | `/api/v1/campaigns/{id}/report.csv`    | any     | Campaign report CSV attachment |
| GET    | `/api/v1/campaigns/{id}/rewards.csv`   | any     | Rewards ledger CSV attachment |

`managers` = OWNER, ADMIN, CAMPAIGN_MANAGER. Publishing requires valid
terms (name, URL, objectives, ≥1 reward rule with positive amounts,
attribution window 1–90 days); issues are returned as `409`.

## Deliverables and submissions

| Method | Path                                              | Roles                | Purpose |
| ------ | ------------------------------------------------- | -------------------- | ------- |
| GET/POST          | `/api/v1/campaigns/{id}/deliverables`     | any / managers       | List / add deliverable requirement |
| PATCH/DELETE      | `/api/v1/deliverables/{id}`               | managers             | Edit / remove requirement |
| GET/POST          | `/api/v1/campaigns/{id}/submissions`      | managers / creator   | Review queue / submit evidence |
| GET               | `/api/v1/submissions/{id}`                | submitter or workspace | Submission detail |
| POST              | `/api/v1/submissions/{id}/approve`        | reviewers            | Approve evidence |
| POST              | `/api/v1/submissions/{id}/reject`         | reviewers            | Reject — `reviewNote` **required** |
| POST              | `/api/v1/submissions/{id}/request-revision` | reviewers          | Send back with note |
| GET               | `/api/v1/creators/me/submissions`         | creator              | Own submission history |

`reviewers` = OWNER, ADMIN, REVIEWER. Submissions verify the creator is an
ACTIVE participant and the deliverable belongs to the same campaign.

## Tracking links and clicks

| Method | Path                                              | Roles    | Purpose |
| ------ | ------------------------------------------------- | -------- | ------- |
| POST   | `/api/v1/campaigns/{id}/tracking-links`           | managers | Issue a link for an ACTIVE participant |
| POST   | `/api/v1/tracking-links/{linkId}/disable`         | managers | Stop recording clicks from a link |
| GET    | `/api/v1/campaigns/{id}/clicks`                   | any      | Click log (paginated) |
| GET    | `/api/v1/creators/me/campaigns/{id}/tracking-link`| creator  | Own link |
| GET    | `/api/v1/creators/me/campaigns/{id}/analytics`    | creator  | Own click/submission stats |
| GET    | `/r/{token}` (page)                               | none     | Redirect: records click, forwards to destination |

## Conversion events

| Method | Path                                     | Roles           | Purpose |
| ------ | ---------------------------------------- | --------------- | ------- |
| POST   | `/api/v1/campaigns/{id}/events`          | managers        | Record event for a campaign |
| POST   | `/api/v1/events`                         | workspace member| Same ingestion, campaign in body (integration path) |
| GET    | `/api/v1/events/{eventId}`               | workspace       | Event detail with attribution/review reason |
| POST   | `/api/v1/events/{eventId}/verify`        | managers        | Verification axis |
| POST   | `/api/v1/events/{eventId}/mark-eligible` | managers        | Eligibility axis (recorded reason) |
| POST   | `/api/v1/events/{eventId}/reject`        | managers        | Reject with reason — never enters rewards |
| GET    | `/api/v1/integrations/events`            | workspace       | Integration/test event feed |
| POST   | `/api/v1/integrations/test-events`       | managers        | Create labelled test event (`isTest: true`, always INELIGIBLE) |

Events accept `source` ∈ API / IMPORT / MANUAL / PROMO_CODE. Attribution is
last eligible click within the campaign window; unattributed events stay
UNDER_REVIEW/INELIGIBLE with a recorded reason. Test events never enter
reward calculations.

## Rewards and settlement

| Method | Path                                      | Roles      | Purpose |
| ------ | ----------------------------------------- | ---------- | ------- |
| POST   | `/api/v1/campaigns/{id}/rewards/calculate` | managers  | Recalculate from eligible events (versioned, additive) |
| GET    | `/api/v1/campaigns/{id}/rewards`           | any       | Rewards ledger |
| GET    | `/api/v1/rewards/{rewardId}`               | workspace or creator | Reward detail + lines + settlements |
| POST   | `/api/v1/rewards/{rewardId}/approve`       | finance   | Approve (finance = OWNER, ADMIN, FINANCE) |
| POST   | `/api/v1/rewards/{rewardId}/settle`        | finance   | Mark payable (no money moves) |
| POST   | `/api/v1/rewards/{rewardId}/settlements/manual` | finance | Record operator-entered settlement (method + reference); **not** provider-confirmed |
| GET    | `/api/v1/rewards/{rewardId}/settlements`   | workspace or creator | Settlement history |
| POST   | `/api/v1/rewards/{rewardId}/dispute`       | finance   | Dispute with reason — blocks settlement |
| GET    | `/api/v1/creators/me/rewards`              | creator   | Own rewards |

Status flow: CALCULATED → APPROVED → PAYABLE → PAID; DISPUTED is a
separate axis that blocks settlement. Adjustments create new versions —
rows are never deleted.

## Invitations and participation

| Method | Path                                | Roles         | Purpose |
| ------ | ----------------------------------- | ------------- | ------- |
| POST   | `/api/v1/campaigns/{id}/invitations`| managers      | Invite creator by email |
| GET    | `/api/v1/invitations/{token}`       | invited user  | Invitation preview |
| POST   | `/api/v1/invitations/{token}/accept`| invited user  | Accept; snapshots terms vN, creates participant + link |
| POST   | `/api/v1/invitations/{token}/decline`| invited user | Decline with reason |

## Creator portal

| Method | Path                                    | Purpose |
| ------ | --------------------------------------- | ------- |
| GET    | `/api/v1/creators/me/overview`          | Dashboard summary |
| GET/PATCH | `/api/v1/creators/me/profile`       | Profile |
| GET    | `/api/v1/creators/me/campaigns`         | Joined campaigns |
| GET    | `/api/v1/creators/me/campaigns/{id}`    | Own campaign brief + accepted terms |

Creators can never approve rewards, edit rules after acceptance, or access
another workspace's data.

## Notifications

| Method | Path                                    | Purpose |
| ------ | --------------------------------------- | ------- |
| GET    | `/api/v1/notifications`                 | Own notifications (`?filter=unread`) |
| POST   | `/api/v1/notifications/{id}/read`       | Mark read (own only; 403 otherwise) |

Generated on submission created (workspace managers) and on submission
approved / rejected / revision requested, reward approved / settled /
disputed (the creator).
