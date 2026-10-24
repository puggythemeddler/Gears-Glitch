# Control Plane M-Pesa sandbox setup

This integration is deliberately pinned to Safaricom's **sandbox** endpoints. It does not support production Daraja credentials or production API URLs.

## Configuration

After creating a Daraja sandbox app with the M-Pesa Express product, set these environment variables on the Control Plane service in Render:

| Variable | Value |
| --- | --- |
| `DARAJA_CONSUMER_KEY` | Consumer key for the sandbox app |
| `DARAJA_CONSUMER_SECRET` | Consumer secret for the sandbox app |
| `DARAJA_SHORTCODE` | `BusinessShortCode`: sandbox Paybill or Head Office shortcode |
| `DARAJA_PARTY_B` | Till number when using `CustomerBuyGoodsOnline`; omitted for Paybill |
| `DARAJA_PASSKEY` | Sandbox passkey |
| `DARAJA_CALLBACK_URL` | Public HTTPS origin of this Control Plane, e.g. `https://control-plane.example.com` |
| `DARAJA_TRANSACTION_TYPE` | `CustomerPayBillOnline` for Paybill or `CustomerBuyGoodsOnline` for Till; defaults to Paybill |

Do not commit credentials or send them in chat. The callback URL is built per payment attempt under `/api/mpesa/stk-callback/` and includes a random, one-time capability token. The service must be publicly reachable over HTTPS for Safaricom callbacks.

## Flow

1. An administrator opens a pending or overdue KES invoice and chooses **M-Pesa**.
2. The administrator enters the customer's Kenyan phone number and confirms the amount. The number is sent to Safaricom to start the STK prompt; only its last four digits are stored in the Control Plane.
3. The invoice remains unpaid while the attempt is pending. A callback is accepted only when its one-time token, checkout ID, merchant request ID, amount, and receipt match the stored attempt.
4. On a matching success callback, the Control Plane asks the tenant backend to mark the invoice paid, records the receipt, and updates the subscription dates. Any mismatch or downstream failure is left in `needs_review`; it is not silently marked paid.

## Current limits

- Daraja requests always use the sandbox host in code. There is no production-mode switch.
- Only whole-KES invoices and Kenyan mobile numbers are accepted by the STK flow.
- The callback is protected with an unguessable per-attempt URL token and provider request IDs. Daraja callbacks are asynchronous; sandbox end-to-end testing must confirm the deployed callback reaches the service as expected.
- Test with sandbox app data only. Do not enable or deploy production payment collection from this implementation without a separate security review and production-readiness task.
