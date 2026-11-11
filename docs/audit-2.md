# MVP1 Audit Report

**Audit status:** Complete  
**Tests:** 39/39 passing  
**Working tree:** Clean  
**Commits:** 5

## MVP Audit Gaps

| # | Gap | Status | Evidence |
|---:|---|---|---|
| 1 | Migrations | ✅ Done | `0_init`, `0001_mvp_contract_gaps`, and `migration_lock.toml` |
| 2 | NUMERIC/Decimal money | ✅ Done | `money-server.ts` and all server consumers converted; commits `2d30a11` and `8044c18`; tests pass |
| 3 | 404 for hidden resources | ❌ Not started | `requireWorkspace` still throws `forbidden` (`auth.ts:188`); wrong-user notifications still return `forbidden` (`read/route.ts:21`); tests still assert 403 |
| 4 | Rate limiting | ❌ Not started | `rate-limit.ts` is missing; no wiring exists. Only the previously added `rateLimited` helper exists in `errors.ts` |
| 5 | `Idempotency-Key` header | ❌ Not started | `idempotency.ts` is missing; no header handling exists, although the schema model does |
| 6 | Hashed tokens | ✅ Done | Invitation create, GET, accept, and decline use `tokenHash: sha256(token)`; seed stores the hash |
| 7 | Structured logging | ✅ Done | `logging.ts` and `withApi(request, ...)` correlate `request_id` in logs and error bodies; verified live |
| 8 | New tables and endpoints | 🔄 Partial | Tables and `AttributionRecord` writes are complete; adjustment and credential endpoints, plus bearer auth for `POST /events`, are missing |
| 9 | Workspace timezone | 🔄 Partial | Column exists with `Africa/Lagos`; API validation and wiring in workspaces/current are missing |

**Score:** 4 done · 2 partial · 3 not started

## Gap Details

### Gap 8: New Tables and Endpoints

Progress is **2/4 complete**:

- ✅ Schema includes `IdempotencyKey`, `AttributionRecord`, `RewardAdjustment`, and `IntegrationCredential`.
- ✅ `AttributionRecord` is written during event ingestion.
- ❌ Adjustment endpoint is missing.
- ❌ Credential CRUD is missing.
- ❌ Bearer authentication for `POST /events` is missing.

### Gap 9: Workspace Timezone

- ✅ The database column exists and defaults to `Africa/Lagos`.
- ❌ API validation is missing.
- ❌ Workspace create/update and current-workspace flows do not accept or wire the timezone.

## Broader Roadmap

### Completed

- Authentication and RBAC
- Campaigns and lifecycle
- Invitations
- Deliverables and submissions
- Tracking and clicks
- Event review
- Rewards, settlement, and dispute handling
- Analytics, CSV exports, and audit
- Notifications
- Seed/demo data
- Health endpoints: `/health/live` and `/health/ready`
- 39 tests
- `docs/API.md` (177 lines)
- README
- Smoke script

## Remaining Release-Gate Gaps

### Security Gate

- Tenant isolation is tested ✅, but returns 403 instead of the required 404 for unknown or deliberately hidden resources (§5.9).
- Rate limits are absent, despite being a §8 must-have.
- `Idempotency-Key` support is absent.

### Data-Integrity Gate

- Events are idempotent through `externalEventId`.
- Settlement and calculation retries are not yet idempotent (Gap 5).

### Testing Gate

- No Playwright end-to-end suite exists, although the plan requires one.
- Tests are missing for rate limiting, idempotency, adjustments, and credentials.

### Documentation

The README does not yet document:

- `migrate deploy`
- Idempotency
- Rate limits
- 404 semantics
- Token-hashing rationale
- The single-instance rate-limit limitation

### Operations Gate

Backups and staging separation are outside the scope of the local implementation.

## Recommended Next Steps

1. **Gap 3 — 404 semantics:** Change cross-tenant `requireWorkspace` and wrong-user notification responses to `notFound`; update tests from 403 to 404.
2. **Gap 4 — Rate limiting:** Add `rate-limit.ts` and wire it to login, registration, invitation accept/decline, `/r/`, and event ingestion. Return 429 with `Retry-After`.
3. **Gap 5 — Idempotency:** Add `idempotency.ts` and wire it to calculation, approval, settlement, and manual-settlement operations. Events already use `externalEventId`.
4. **Gap 8 — Finish endpoints:** Add reward-adjustment and credential CRUD endpoints, plus bearer authentication for `POST /events`.
5. **Gap 9 — Timezone:** Validate timezone values and wire timezone through workspace create/update and current-workspace flows.
6. **Tests:** Add rate-limit, idempotency, adjustment, and credential tests; update 403 assertions to 404.
7. **Docs:** Update the README and `docs/API.md` with migration deployment, rate limits, idempotency, 404 semantics, token hashing, and the single-instance limitation.
8. **Final verification:** Reseed, run the smoke test, run the complete test suite, and commit the final changes.

## Biggest Risks

The two most significant remaining plan risks are:

1. **Rate limiting (Gap 4):** A §8 must-have that is entirely absent.
2. **Idempotency (Gap 5):** A §8 must-have that is entirely absent and affects calculation and settlement retries.

Gap 3 is smaller but should be completed first because it touches a narrow set of handlers and tests.
