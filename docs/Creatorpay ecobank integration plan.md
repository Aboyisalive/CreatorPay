# CreatorPay x Ecobank: MVP Integration Plan (v2)

Updated 28 Oct 2026. Written to be handed to a coding agent as well as read by a human.

Legend: **(community)** = from a third-party write-up, not Ecobank's own pages, treat as a hypothesis until a real call confirms it. **(unconfirmed)** = could not be verified from public sources, ask the organizers or test.

---

## 0. Agent brief (read this first)

**What we are building:** the payments backbone for CreatorPay, a creator campaign management platform. Brands fund campaigns, creators are paid when contracts complete. Rail: Ecobank's new developer portal (`apimuat-developer.ecobank.com`), sandbox only, for a hackathon demo.

**Current access (this determines scope):**

- Subscribed: the **core product** containing Authentication Service, Local Bank Payment Service, Notification Service. One subscription key pair should cover all three.
- **Not available:** Account Enquiry (cannot subscribe), Collection (not visible in the portal), any virtual account API (none found).
- Not yet received: onboarding credentials (clientId, sourceCode, affiliateCode, publicKey, secretKey, configured IP). Real signed calls depend on them.

**Rules for the agent:**

1. **Do not invent Ecobank endpoints, field names or response shapes.** Everything in section 11 is community-sourced. If a real OpenAPI spec or Postman export exists under `/docs/ecobank/`, that overrides this file.
2. **Mock first.** Everything must work end to end against `MockProvider` (`PAYMENT_PROVIDER=mock`). `EcobankProvider` is swapped in only for the calls that are actually available (token, domestic/interbank payout, payout status, notification webhook).
3. **Tests before integration.** Signature and amount-formatting unit tests are written before any HTTP client code.
4. **Never log or commit secrets.** No keys, secret key, tokens or full signatures in logs, fixtures or git. Commit `.env.example` only.
5. **Money is integer minor units (kobo).** No floats anywhere. One canonical amount-to-string function.
6. **The internal ledger is the source of truth,** Ecobank is the rail. Double-entry, append-only.
7. **Idempotency:** mint and persist `request_id` before any bank call; reuse it on retry. Store the bank's `transactionReference` too.
8. **A transfer acknowledgement is not settlement.** Only a status query (or confirmed webhook) moves a payout to `settled`.
9. **Read the response body code, not the HTTP status** (reported HTTP 200 on refusals) (community).
10. **When something is unknown, build a seam and a TODO, do not guess.** List new unknowns in section 15.

**Default stack** (unless the repo already decides otherwise): Python + FastAPI, Postgres, Docker, pytest. The adapter interface in section 10 ports directly to Go or TypeScript.

**Build order and acceptance criteria are in section 12.**

---

## 1. Goals and non-goals

### MVP goals

1. A brand funds a campaign and the platform credits that campaign's escrow in the ledger.
2. Creator bank details are sanity-checked before any payout.
3. On contract completion, the platform pays the creator through Ecobank Local Bank Payment and confirms settlement by status query.
4. A convincing end-to-end sandbox demo with a mock fallback and a recorded backup.

### Non-goals

Production go-live, Collection card/QR, Account Enquiry, XpressCash, Remittance, Bill Payment, Direct Debit, Account Opening, virtual accounts, refunds, disputes, tax.

---

## 2. Reality of the Ecobank API landscape

Two generations exist. Our credentials target the **new portal**.

| | Legacy Unified API (`developer.ecobank.com`) | New portal (`apimuat-developer.ecobank.com`) |
|---|---|---|
| Scope | Unified collections + payments: wallets, QR (EcobankPay), cards, account transactions | Corporate-style REST services: Authentication, Local Bank Payment, Notification, Account Enquiry, Account Opening, Bill Payment, Remittance, XpressCash Token, Payment From Ecobank Account, Collection, Direct Debit |
| Auth | UserID + password + lab key; `secureHash` | Per-product subscription key + bearer token per `serviceCode`; SHA-512 signatures (community) |
| Go-live | Test-case file + KYC | Sandbox, UAT, production after test-case document is validated |

Portal pages: Home, Products, Sandbox (`/apis`), Documentation, Support, FAQ. API detail pages use the pattern `/api-details#api=<api-id>`; known ids: `corporate-api-authentication-service`, `corporate-api-payment-service`, `corporate-api-notification-service`.

**Action:** from the Sandbox / API detail pages, download each API's OpenAPI definition (and any Postman export) into `/docs/ecobank/`. This is the best source of truth for the agent.

---

## 3. Credential layers

| Layer | What | Count | Source |
|---|---|---|---|
| 1. Subscription key | Primary + secondary pair per product subscription, sent as `Ocp-Apim-Subscription-Key` (community). Use one at a time; the second is for rotation. | 1 pair for the core product | Portal > Profile |
| 2. Bearer token | Short-lived (about 5 min), minted per `serviceCode`. A token for one service is refused by others. | One per service in use | Token endpoint at runtime, `requestType = GET_API_TOKEN` |
| 3. Onboarding credentials | `clientId`, `sourceCode`, `affiliateCode`, `publicKey`, `secretKey` (never transmitted, only hashed), configured `ipAddress` | One set | Bank / organizers. **Not visible in the portal.** |

Known `serviceCode` values (community): `DOMESTIC`, `INTERBANK`, `ACCOUNT_TRANSFER`, `BILLPAYMENT`, `TOKEN`, `DIRECTDEBIT`, `REMITTANCE`.

The Notification Service is described by the portal as a notification/callback microservice. How callback URLs are registered and how payloads are signed is **(unconfirmed)**.

---

## 4. Subscription status

| Need | Product / API | Status |
|---|---|---|
| Auth | Authentication Service | **Subscribed** (in core product) |
| Payout + status | Local Bank Payment Service | **Subscribed** (in core product) |
| Deposit webhooks | Notification Service | **Subscribed** (in core product), registration process unconfirmed |
| Creator account verification | Account Enquiry | **Blocked**: cannot subscribe. Asked organizers. |
| Brand pay-in | Collection / Payment From Ecobank Account | **Blocked**: not visible. Asked organizers. |
| Virtual accounts | none found | **Does not exist** as far as public docs show |

Decision: demo on sandbox with what is available, simulate or substitute the rest behind provider seams (sections 5 and 6). If the organizers enable more products later, only the adapter changes.

---

## 5. Funding model without Collection or virtual accounts

Goal: brands "send money to be paid out to creators after contract completion", with per-campaign tracking.

**Design: one pool account + unique funding reference + ledger escrow.**

1. Every campaign gets a unique funding reference, e.g. `CP-<campaign short id>-<random>`.
2. The brand is shown pool account details and the reference to quote as the transfer narration.
3. Incoming credits are detected by the **Notification webhook** (primary) or a reconciliation poll (fallback, if any balance/statement call becomes available).
4. A matcher links each credit to a campaign by reference (then by exact amount + sender as a weaker fallback) and writes `brand_funds_in_transit -> campaign_escrow:{id}`.
5. Unmatched credits go to an **unmatched deposits** queue in the admin view.
6. When a contract completes, the platform pays the creator from the pool via Local Bank Payment.

**Sandbox/demo mode (important):** the sandbox will not produce real inbound deposits. Provide a `FundingSimulator` (admin "mark funded" action and/or a fake webhook injector that posts a payload to the real webhook handler). Everything downstream (ledger, approvals, real payout call, status polling) stays real. Be honest in the pitch: card/QR collection is the next integration step.

**Tradeoff to document:** narration matching is weaker than true virtual accounts because senders can mistype or omit the reference. If Collection (card/QR) becomes available, the reference travels with the payment and this weakness disappears.

**Ask the organizers** whether Collection or any other API issues virtual or per-transaction account numbers (open question 8).

**Production note (pitch):** pooling third-party funds usually means a licensed partner-bank or regulated custody arrangement. Verify specifics for Nigeria before making claims.

---

## 6. Creator account verification without Account Enquiry

Interface method `verify_account()` stays in the provider contract. Until Account Enquiry is enabled:

1. **Offline NUBAN check-digit validation** (catches mistyped numbers, does not confirm the account name).
2. **On-screen confirmation:** the creator confirms their account name and bank before payout is enabled.
3. Optionally display any beneficiary name the payout response returns (**unconfirmed** whether it does).

```python
def nuban_valid(bank_code: str, account_no: str) -> bool:
    """3-digit CBN bank code + 10-digit NUBAN. Offline sanity check only."""
    if len(bank_code) != 3 or len(account_no) != 10 or not (bank_code + account_no).isdigit():
        return False
    weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
    digits = [int(c) for c in bank_code + account_no[:9]]
    total = sum(d * w for d, w in zip(digits, weights))
    check = (10 - total % 10) % 10
    return check == int(account_no[9])
```

Notes: needs the 3-digit bank code, which may differ from the bank identifier the Local Bank Payment API expects (unconfirmed, check the schema). Some institutions (e.g. fintech/MFB accounts) may not pass a standard NUBAN check, so treat failure as a warning plus confirmation prompt where appropriate, not a hard block, unless you decide otherwise.

---

## 7. Remaining setup checklist (human tasks)

- [x] Partner account created, core product subscribed
- [ ] Copy the primary key from Profile into `.env` (`ECOBANK_KEY_CORE`)
- [ ] **Download OpenAPI definitions / Postman collections** for Authentication, Local Bank Payment, Notification into `/docs/ecobank/`
- [ ] In the Sandbox, run **Try it** on the token call and the domestic payment call with default payloads; save working request/response examples (secrets blanked)
- [ ] Send the organizers message (section 8)
- [ ] Get a **static egress IP** for the backend (the IP is part of the signed payload and must match between the token call and the payment it authorizes)
- [ ] Stable public HTTPS URL for the webhook receiver (named cloudflared tunnel or small deployed endpoint, not a rotating URL)
- [ ] Receive onboarding credentials, then run the first real signed token + payment + status loop

---

## 8. Message to the organizers

> Hi, we are team CreatorPay (creator campaign payments). We are on the new Ecobank developer portal and subscribed to the core product (Authentication, Local Bank Payment, Notification). Could you help with:
>
> 1. Onboarding credentials: clientId, sourceCode, affiliateCode, publicKey, secretKey, and the configured IP (we cannot see these in the portal).
> 2. The affiliate code for Nigeria, and NGN support in the sandbox.
> 3. Enabling **Account Enquiry** (we cannot subscribe) and **Collection** / Payment From Ecobank Account (not visible) for our account, or the exact product names.
> 4. Whether any API issues virtual or per-transaction account numbers we can assign per campaign.
> 5. How to register a callback URL for the Notification Service, and its payload format and signing.
> 6. Which pool/debit account sandbox payouts use, and whether it is funded.
> 7. How the destination bank is specified for domestic vs interbank transfers (bank code format).
> 8. Static IP / whitelisting requirements.
> 9. Any Blaze-specific endpoints for InnovateX participants, and the test-case document if there is one.

---

## 9. Environment variables

```bash
# --- Environment ---
ECOBANK_ENV=sandbox
ECOBANK_BASE_URL=https://apimuat-gateway.ecobank.com   # community; confirm from the API definition

# --- Layer 1: subscription key (core product covers Auth + Payment + Notification) ---
ECOBANK_KEY_CORE=
# Add later only if the organizers enable them:
# ECOBANK_KEY_ACCOUNT=
# ECOBANK_KEY_COLLECTION=

# --- Layer 3: onboarding credentials ---
ECOBANK_CLIENT_ID=
ECOBANK_SOURCE_CODE=
ECOBANK_AFFILIATE_CODE=        # Nigeria code unconfirmed; online examples use EGH (Ghana)
ECOBANK_PUBLIC_KEY=
ECOBANK_SECRET_KEY=            # never log, never ship to a client
ECOBANK_IP_ADDRESS=            # static egress IP, configured not auto-detected

# --- Platform ---
ECOBANK_DEFAULT_CURRENCY=NGN   # unconfirmed sandbox support
ECOBANK_WEBHOOK_PUBLIC_URL=
PAYMENT_PROVIDER=mock          # mock | ecobank
FUNDING_MODE=simulated         # simulated | webhook
```

---

## 10. Architecture

### 10.1 Provider adapter

Platform code never touches Ecobank types.

```python
# provider.py
from dataclasses import dataclass
from typing import Protocol, Literal

@dataclass
class FundingInstructions:
    funding_reference: str        # unique per campaign, quoted by the brand
    pool_account_display: str     # whatever is shown to the brand
    expires_at: str | None

@dataclass
class AccountCheck:
    status: Literal["verified", "format_ok_unverified", "invalid"]
    account_name: str | None
    reason: str | None

@dataclass
class PayoutResult:
    request_id: str               # ours, stored BEFORE the call
    bank_reference: str | None    # bank's transactionReference
    state: Literal["pending", "settled", "failed", "unknown"]
    raw_code: str | None

class PaymentProvider(Protocol):
    def funding_instructions(self, campaign_id: str, amount_minor: int, currency: str) -> FundingInstructions: ...
    def verify_account(self, account_no: str, bank_code: str | None) -> AccountCheck: ...
    def payout(self, account_no: str, bank_code: str | None, amount_minor: int,
               currency: str, narration: str, request_id: str) -> PayoutResult: ...
    def payout_status(self, bank_reference: str) -> PayoutResult: ...
```

Implementations:

- `MockProvider`: scriptable outcomes (success, pending-then-success, failure, timeout, HTTP-200-with-error-body, duplicate/out-of-order webhooks).
- `EcobankProvider`: real token, payout, status; `verify_account` returns `format_ok_unverified` via NUBAN until Account Enquiry exists; `funding_instructions` returns the pool account + reference.

### 10.2 Ledger

Accounts: `brand_funds_in_transit`, `campaign_escrow:{campaign_id}`, `creator_payable:{creator_id}`, `platform_fees`, `paid_out`, `unmatched_deposits`.

Flow:

1. Deposit matched: `brand_funds_in_transit -> campaign_escrow`
2. Contract completed / deliverable approved: `campaign_escrow -> creator_payable` (fee to `platform_fees`)
3. Payout submitted: state change only
4. Payout settled: `creator_payable -> paid_out`
5. Payout failed: no ledger move, creator stays payable
6. Deposit unmatched: `brand_funds_in_transit -> unmatched_deposits`, resolved manually

### 10.3 Schema (Postgres)

```sql
create table campaigns (
  id uuid primary key,
  brand_id uuid not null,
  title text not null,
  budget_minor bigint not null,
  currency char(3) not null default 'NGN',
  funding_reference text not null unique,
  state text not null check (state in ('draft','awaiting_funds','funded','active','closed')),
  created_at timestamptz not null default now()
);

create table deposits (
  id uuid primary key,
  campaign_id uuid references campaigns(id),         -- null while unmatched
  dedupe_key text not null unique,                   -- derived from bank ref + event type
  bank_reference text,
  amount_minor bigint not null,
  sender_hint text,
  matched_by text check (matched_by in ('reference','amount_sender','manual','simulated')),
  state text not null check (state in ('received','matched','unmatched','rejected')),
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id),
  creator_id uuid not null,
  amount_minor bigint not null,
  state text not null check (state in ('offered','accepted','delivered','approved','paid','cancelled')),
  created_at timestamptz not null default now()
);

create table creator_bank_details (
  creator_id uuid primary key,
  bank_code text not null,
  account_no text not null,
  account_name_confirmed text,                       -- creator-confirmed name
  nuban_ok boolean not null,
  verified_by_bank boolean not null default false,   -- true only via Account Enquiry
  updated_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key,
  contract_id uuid not null references contracts(id),
  request_id text not null unique,                   -- minted + stored BEFORE the bank call
  bank_reference text,                               -- keep column wide, never truncate
  amount_minor bigint not null,
  state text not null check (state in ('approved','submitted','pending','settled','failed','unknown')),
  attempts int not null default 0,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table provider_calls (                         -- audit trail, secrets redacted
  id bigserial primary key,
  request_id text not null,
  endpoint text not null,
  response_code text,
  http_status int,
  duration_ms int,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id bigserial primary key,
  dedupe_key text unique,
  raw_body jsonb not null,
  raw_headers jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table journal_entries (
  id bigserial primary key,
  ref_type text not null, ref_id uuid not null,
  debit_account text not null, credit_account text not null,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);
```

### 10.4 State machines and rules

- **Deposit:** `received -> matched | unmatched | rejected`
- **Payout:** `approved -> submitted -> pending -> settled | failed`, plus `unknown` after transport failure/timeout.
- Mint and store `request_id` before the call; reuse on retry.
- Transport failure means **unknown**, resolve via status query, never resend under a new ID.
- Anything not explicitly failed is **pending**.
- Read `headerResponse.responseCode` (community). `000` is the only success.

### 10.5 Response codes (community)

| Code | Meaning |
|---|---|
| `000` | Success |
| `001` | Generic processing failure |
| `400` | Malformed request; description names the field |
| `401` | Authentication failed (wrong signature lands here) |
| `404` | Not found |
| `999` | Unexpected server error |

A bad signature gives an "invalid request token" style message without saying which hash is wrong.

### 10.6 Reconciliation job

Every minute during the demo window: select payouts in `submitted`, `pending`, `unknown` older than ~20 s, call `payout_status(bank_reference)`, update state + ledger in one transaction, back off with jitter, cap attempts, surface stuck items in admin.

### 10.7 Webhooks

- Store raw body + headers first, process second.
- De-duplicate with a derived key; assume duplicates and out-of-order delivery.
- Verification scheme is unconfirmed; implement a verifier interface with a pass-through default and a TODO, and log everything.
- The `FundingSimulator` posts synthetic events to the same handler so the production path is exercised.

---

## 11. Signing and calls (community reference, Local Bank Payment)

Source: an open-source reference implementation. **Verify against the real API definition.**

Base URL (UAT gateway): `https://apimuat-gateway.ecobank.com`

Headers on every call:

```
Content-Type: application/json
Accept: application/json
Cache-Control: no-cache
Ocp-Apim-Subscription-Key: <core product subscription key>
Authorization: Bearer <access token>      # all but the token call
```

| Call | Method + path |
|---|---|
| Token | `POST /corp-auth/api/v2/integration/auth/app/token` |
| Domestic transfer | `POST /corp-payment/api/v2/payment/domestic` |
| Transaction status | `POST /corp-payment/api/v2/integration/payment/status` |

Interbank transfer path and body: **(unconfirmed)**, read from the API definition.

Algorithm: SHA-512 over UTF-8, lowercase hex (128 chars). **Not HMAC.** Secret is plainly appended.

```
requestToken = SHA512( clientId + affiliateCode + sourceCode + requestId + requestType + ipAddress + secretKey )

secureHash   = SHA512( clientId + affiliateCode + sourceCode + requestId + requestType + ipAddress
                       + requestToken
                       + <endpoint-specific fields in documented order>
                       + secretKey )
```

| Call | Fields appended after `requestToken` |
|---|---|
| Token request | `publicKey`, `serviceCode` |
| Domestic transfer | `receiverAccountNo`, `amountString`, `currency`, `description` |
| Transaction status | `transactionReference` |

Three traps:

1. `requestToken` feeds into `secureHash`. Compute the first, then use it in the second.
2. Hash field order is **not** JSON order (payload starts `affiliateCode, clientId`; hash starts `clientId, affiliateCode`).
3. Amount is hashed as text and must match the body's rendering exactly. `str(50000.0)` is `"50000.0"`, a JSON encoder may write `50000`. One canonical formatter for body and hash.

```python
import hashlib

def sha512_hex(s: str) -> str:
    return hashlib.sha512(s.encode("utf-8")).hexdigest()

def header_base(h: dict) -> str:
    return (h["clientId"] + h["affiliateCode"] + h["sourceCode"]
            + h["requestId"] + h["requestType"] + h["ipAddress"])

def sign(h: dict, secret: str, tail: list[str]) -> tuple[str, str]:
    base = header_base(h)
    request_token = sha512_hex(base + secret)
    secure_hash = sha512_hex(base + request_token + "".join(tail) + secret)
    return request_token, secure_hash
```

Token behavior: about 5 minutes. Cache per `serviceCode` for about 3 minutes. On `401`, drop the cached token and retry **once**.

Reported docs defects (community, Sep 2026): blank `service-code` and `request-type` pages, base-URL mismatch on the auth page (the operation URL is the one that works), `amount` marked optional on the domestic schema (treat as required), bulk-transfer hash formula ending in `public_key` instead of `secret_key`. Also reported: the debited account is the pool account tied to the client ID, not a request field, and **the sandbox accepted a stale hash and returned success** (measured 13 Sep 2026), so a green sandbox response does not prove the signing is right.

---

## 12. Build order for the agent (with acceptance criteria)

| # | Milestone | Done when |
|---|---|---|
| 1 | Repo skeleton, config loader, `.env.example`, Docker + Postgres, secrets never logged | App boots, config validates, no secrets in logs |
| 2 | Provider interface + `MockProvider` with scriptable scenarios | All scenarios in section 13 selectable by config |
| 3 | Ledger + schema + migrations + invariants | Journal always balances; property test passes |
| 4 | **Signing module + unit tests** (vectors, ordering, amount formatting) | Tests pass without any network |
| 5 | Funding flow: instructions, deposits table, matcher, unmatched queue, `FundingSimulator` | Simulated deposit credits campaign escrow once, duplicates ignored |
| 6 | Creator bank details + NUBAN check + confirmation step | Invalid numbers rejected, confirmed name stored |
| 7 | Contract completion -> payout state machine against mock | Payout goes approved to settled; failure and unknown handled |
| 8 | Reconciliation job | Stuck pending/unknown items resolve via status |
| 9 | `EcobankProvider` token + status call (read-only first) | Real token minted and cached per service; 401 retry works |
| 10 | `EcobankProvider` domestic payout + status loop (needs onboarding credentials) | Real sandbox payout round trip, logged with redaction |
| 11 | Webhook receiver (raw store, dedupe, handler shared with simulator) | Real or replayed payload lands in `deposits` |
| 12 | Admin view: campaigns, deposits (unmatched queue), payouts, provider_calls | Demo operator can see and resolve everything |
| 13 | Demo hardening: provider flag, seeded demo data, backup video | Full flow 3 times from a clean DB |

Milestones 1 to 8 need **no** Ecobank credentials. Do them first.

---

## 13. Testing

1. **Signature unit tests:** vectors with the exact concatenated string and expected digest; ordering test (the document-order mistake must **not** match); amount-string test (hashed text equals body text); stale-hash negative test.
2. **Ledger tests:** every journal balances; replaying events is idempotent; no negative escrow.
3. **MockProvider scenarios:**

| Scenario | Expected behavior |
|---|---|
| Timeout on payout | `unknown`, reconcile via status, no resend with new ID |
| HTTP 200 + failure code | Treated as failure |
| Pending then success after N polls | Eventually `settled`, one ledger entry |
| Duplicate webhook | One ledger entry only |
| Out-of-order webhook | Correct final state |
| 401 on cached token | Re-mint once, retry once, then surface error |
| Invalid NUBAN | Blocked or warned per policy |
| Unmatched deposit | Lands in unmatched queue |
| Insufficient pool balance | Payout failed cleanly, creator stays payable |

4. **Sandbox integration tests** (once credentials exist): token, domestic payout, status. Sandbox returns static responses with default payloads, so these prove plumbing only.
5. **Webhook tests:** replay captured payloads against the handler; verify raw storage.
6. **Demo rehearsal:** full flow three times from a clean database; recorded backup video; one-flag switch to mock.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Onboarding credentials arrive late | Milestones 1 to 8 are credential-free; mock-first |
| Account Enquiry / Collection never enabled | Seams already in place (sections 5, 6); pitch honestly |
| Sandbox accepts wrong signatures (false green) | Independent signature unit tests |
| Notification payload and signing unknown | Raw-first storage, simulator, polling fallback |
| Nigeria affiliate code / NGN unsupported in sandbox | Ask early; demo in the supported currency and explain |
| Docs defects | Prefer the downloaded API definition; ask organizers |
| IP mismatch breaks signatures | Static egress IP, configured not detected |
| HTTP 200 with failure body | Always read the response code; tested |
| Lost response on payout | Idempotent `request_id` + status reconciliation |
| Sandbox down during judging | Mock flag + backup video |
| Eligibility (Blaze account, age band) | Confirm with organizers |
| Narration-matching mismatches | Unmatched queue; push for Collection access |

---

## 15. Open questions tracker

| # | Question | Answer | Date |
|---|---|---|---|
| 1 | Onboarding credentials issued? | | |
| 2 | Nigeria affiliate code and NGN support? | | |
| 3 | Account Enquiry enabled for us? | | |
| 4 | Collection / Payment From Ecobank Account enabled or named? | | |
| 5 | Webhook registration, payload format, signing? | | |
| 6 | Pool/debit account for sandbox payouts; funded? | | |
| 7 | How is the destination bank specified (bank code format)? | | |
| 8 | Any virtual or per-transaction account number API? | | |
| 9 | Static IP / whitelisting requirement? | | |
| 10 | Any Blaze-specific endpoints? | | |
| 11 | Test-case document provided? | | |
| 12 | Does the core subscription key really cover all three APIs? | | |

---

## 16. After the MVP

| Feature | Ecobank API | Value |
|---|---|---|
| True per-campaign funding attribution | Collection (card/QR) or any virtual-account API if one exists | Removes narration-matching weakness |
| Verified creator accounts | Account Enquiry | Name match before payout |
| Creators without bank accounts | XpressCash Token | Inclusion story |
| Cross-border | Remittance | Pan-African reach |
| Tipping / activations | EcobankPay QR | Scan to fund |
| Milestone perks | Bill Payment (airtime/data) | Cheap rewards |
| Brand retainers | Direct Debit | Recurring revenue |
| Fund holds on Blaze accounts | Blaze API (unconfirmed exists) | Escrow story |

---

## 17. References

- New portal: `https://apimuat-developer.ecobank.com/` (Products, Sandbox `/apis`, Documentation, Support, FAQ)
- Legacy portal: `https://developer.ecobank.com/`
- Unified-API Developer Labs Postman docs: `https://documenter.getpostman.com/view/9576712/2s7YtWCtNX`
- Community payout reference (Local Bank Payment): `https://github.com/Fath57/izy-ecobank-payout`
- Community PHP wrapper (legacy shapes): `https://packagist.org/packages/serenity_technologies/ecobank-unified-api`
- InnovateX 2026: `https://www.innovatex.africa/`

Third-party sources are community-maintained and may lag Ecobank's own documentation. Trust the downloaded API definitions, issued credentials and the organizers' answers over anything here.