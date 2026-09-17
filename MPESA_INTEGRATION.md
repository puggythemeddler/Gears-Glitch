# M-Pesa / Daraja Integration

STK push + callback handling for Gears&Glitch. This document records the audited behaviour, the
fixes applied, and the agreed acceptance criteria for "production-ready".

## Env / config

`MPESA_ENV` (`sandbox`|`production`), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`,
`MPESA_PASSKEY`, `MPESA_SHORTCODE` (default `174379`), `MPESA_TILL_NUMBER`.

- `isMpesaConfigured()` is true only when consumer key, consumer secret, **passkey** and
  shortcode are all present. Previously the passkey was not required, so a store with an empty
  passkey "passed" configuration yet every real (non-simulated) STK push failed auth. If not
  configured, `stkPush`/`queryStatus` return a clearly-marked simulated success instead of
  hitting the Sandbox.
- Callback base URL resolution (`callbackBaseUrl(req)`), best → worst:
  1. `MPESA_CALLBACK_URL` (recommended in production — the public HTTPS URL Safaricom must reach),
  2. `BASE_URL`,
  3. the active request's own `scheme://host` (`app.set("trust proxy", 1)` makes this
     proxy-forwarded and therefore correct behind Render).
  See `.env.example` for the new `MPESA_CALLBACK_URL` entry.

## Timestamps (D-1)

Daraja expects the password timestamp in **East Africa Time (UTC+3, no DST)** as
`yyyymmddHHmmss`. The old code generated it from UTC, which drifted 3 hours from what
Safaricom's servers derive — a silent auth-failure class. `mpesaTimestamp()` adds UTC+3 explicitly
and is unit-tested (including the midnight rollover case).

## Phone numbers

`normalizeDarajaPhone()` accepts `07XXXXXXXXX`, `254XXXXXXXXX` (with any formatting), or a bare
9-digit Safaricom-style number, and rejects everything else with a clear error. A leading-zero
9-digit number (`071234567`) is rejected, not silently re-prefixed. `stkPush` validates up front
and throws on invalid input instead of pushing garbage to Daraja.

## STK push flow

`stkPush(phone, amount, accountReference, callbackUrl)`:
- generates the password from the EAT timestamp;
- `PartyA` = normalized `254…` number;
- real push when configured, otherwise a `simulated: true` success that still writes to
  `data/mpesa.log` (masking phone numbers);
- every request/response pair is logged to `data/mpesa.log` with phone/PartyA masked.

POS and storefront call sites (`pushPosStk`, storefront checkout, order-update re-push) all pass
`callbackBaseUrl(req)`. The POS and storefront order-update paths also guard against duplicate
initiation: an existing `checkout_request_id` in a payable pending state is reused (and
`updated_at` bumped) instead of pushing a second STK that could be charged and then cancelled.

## Callback handler (`POST /api/mpesa/callback`)

- Reads `Amount`, `MpesaReceiptNumber`, `CheckoutRequestID`, `MerchantRequestID`, `ResultCode`,
  `ResultDesc`.
- **Amount verification (A-1).** The order's stored total is authoritative:
  `subtotal + shipping_fee − discount_amount − gift_card_amount − points_redeemed`
  (points reconciled from `loyalty_transactions`, since `redeemLoyaltyPoints` does not persist a
  discount on the order). The check runs inside the same transaction that would mark the order
  paid. On mismatch the callback is acknowledged (`ResultCode 0`) so Safaricom does not retry
  forever, but the order is **not** marked paid and stays pending for reconciliation; the
  mismatch is appended to `data/mpesa-callback.log` with the reason.
- **Never lose a payment (D-4).** If the DB transition would have been skipped for a
  non-reconcilable reason, or throws, the handler behaves correctly: success-without-receipt is
  acknowledged without marking paid (the order is left pending, never cancelled), a DB error
  returns HTTP 500 + `ResultCode 1` ("retryable") instead of a swallowed `200`.
- Dedup/state rules in `updateOrderMpesaStatus` (all inside `FOR UPDATE` on the order row):
  - success + receipt + already paid → refresh `mpesa_receipt`, never re-deduct stock;
  - success + receipt + `pending`/`pending_payment` → deduct stock, set `paid`;
  - success + receipt + cancelled → untouched;
  - success **without** receipt → order stays pending, is **never cancelled** (a later receipt or
    a `queryStatus` reconciliation can still resolve it);
  - failure (`ResultCode !== 0`) → release stock, cancel — unless the order is already
    `paid`/`delivered`, which a late failure callback must never undo.
- Verified payment (used by `order.processed`, stock-deduction success paths) means status
  `paid`/`delivered` **or** a non-empty `mpesa_receipt`.

## Settings redaction (S-6)

`GET/PUT /api/admin/settings` never returns `consumerSecret` or `passkey` in full — the M-Pesa
section is returned with those fields blanked, and the response drops the legacy
`settings.mpesa`/`settings.mpesa_config` blobs.

## Known limitations

- Daraja provides **no callback signature/verification mechanism**, so authenticity rests on
  correlation (checkout id + amount verification), idempotent state transitions, and
  `data/mpesa-callback.log`. This is the provider's model, not a gap we can close in-app.
- Production full-loop validation (real STK → real callback) requires live Safaricom credentials
  and a public HTTPS endpoint; it is exercised only with the Sandbox, not with test automation.
- The storefront's orphaned-pending-order reconciliation (`queryStatus` sweep for
  `checkout_request_id`s left in `pending_payment`) is not implemented. The duplicate-initiation
  guard above mitigates overwriting buying another STK, but a `queryStatus` reconciliation sweep
  remains the documented follow-up.

## Tests

`tests/mpesa.test.ts` (pure): EAT timestamp (fixed instant + midnight rollover + current time),
phone normalization (accept + reject), callback URL precedence, and passkey-aware configuration
gating. DB-gated callback/stock assertions run in CI (`DATABASE_URL` set).