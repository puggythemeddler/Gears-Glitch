# Lipa Mdogo Mdogo (Hire Purchase)

Lipa Mdogo Mdogo is the store's instalment / hire-purchase facility. It lets a
customer take an item now and pay for it over a fixed number of instalments.
This document is the operator guide for staff and the reference for how the
feature is wired into the rest of the system.

> This document describes software behaviour only. It is **not** a legal or
> regulatory certification. Hire-purchase contracts, interest/charge disclosure
> and any consumer-credit licence obligations are the merchant's responsibility
> and should be reviewed with a qualified professional before launch.

## What this feature deliberately does NOT do

To keep the facility ethical and within the store's stated boundaries, the
financing module **never**:

- locks, bricks, remotely disables or otherwise interferes with a device;
- monitors SIM cards, location, or any device telemetry;
- performs automatic repossession or recovery actions;
- submits anything to a credit reference bureau (CRB) automatically;
- applies arbitrary or opaque credit scoring;
- adds undisclosed fees, hidden charges or penalties.

Every charge that increases the amount payable is configured in one place and is
shown to the customer before the plan is created.

## Where it lives

| Layer | Location |
| --- | --- |
| Domain types / money helpers | `server/financing/types.ts` |
| Pure calculator | `server/financing/calculator.ts` |
| Payment waterfall / schedule state | `server/financing/allocation.ts` |
| Date helpers | `server/financing/date-utils.ts` |
| Config (stored setting `financing_config`) | `server/financing/config.ts` |
| Database service layer | `server/financing/service.ts` |
| HTTP routes (`/api/financing`) | `server/routes/financing.ts` |
| Admin console | `frontend/components/admin/AdminFinancing.tsx` |
| Customer portal | `frontend/pages/financing.tsx` |
| Product page callout | `frontend/pages/product.tsx` |
| Migration | `server/migrations/0023_financing.sql` |

All amounts are stored and computed as **integer cents** (minor units). The
browser may submit a *preview* (`/api/financing/public/quote`) but every number
that is persisted is produced server-side by `calculator.ts`.

## Enabling financing

1. Sign in as an admin/owner.
2. Go to **Admin → Finance → Lipa Mdogo Mdogo**.
3. Open the **Settings** tab.
4. Tick **Enable Lipa Mdogo Mdogo financing** and save.
5. Optionally tick **Allow customers to apply online**.

Until it is enabled, customers see "not available" and staff cannot create new
applications.

### Configuration reference

| Setting | Meaning |
| --- | --- |
| Enabled | Master switch. |
| Online application allowed | Whether customers may apply from the storefront/portal. |
| Manual approval | Whether each application needs staff approval before an agreement is created. |
| Charge model | `fixed` = flat fee per agreement; `percentage` = % of the cash price. |
| Fixed charge / Charge percent | The value used by the selected charge model. |
| Minimum deposit (%) | Lower bound enforced on the deposit. |
| Min / Max term | Instalment-count bounds. |
| Possession model | `immediate` (after deposit), `threshold` (after a set amount), `on_full_payment` (only when fully paid). |
| Overdue / Serious overdue (days) | Age thresholds used to label a scheduled instalment as overdue / seriously overdue. |
| Grace period (days) | Days after the due date before an instalment is treated as overdue. |
| Serial mandatory | Require a serial number on the financed item. |
| Guarantor required | Require guarantor details on the application. |

## Staff workflow

### 1. Create an application

**Admin → Finance → Lipa Mdogo Mdogo → Applications → New application.**

Choose the customer, optionally a product (the cash price is taken from the
product record, so a client cannot invent a lower price), deposit %, frequency
and number of instalments. Use **Preview** to see the resulting instalment.
Tick that the customer has given informed consent, then create it. You can
submit it for review immediately or leave it as a draft.

### 2. Review and approve/reject

An application moves `draft → submitted → under_review → approved | rejected`.
Approval (`financing:approve`) creates the agreement, the instalment schedule
and an order link atomically. Rejection records the reason.

### 3. Ownership, possession and release

Approving creates the agreement. The item's possession is then controlled by the
configured **possession model**. A staff member uses **Release product** on the
agreement to hand the item over once the model's condition is met.

Ownership stays with the seller (`ownership_status = seller`) and is only marked
`transferred` when the agreement is fully paid and completed.

### 4. Payments

On an agreement you can:

- **Record** a cash/card/bank payment (`financing:payment`).
- **Send STK push** to start an M-Pesa payment.
- **Reverse** a succeeded payment with a reason (restores the outstanding
  balance).

Payments are allocated oldest-due-first. Overpayment becomes unapplied
`credit_cents` on the agreement and is automatically used on the next payment.

### 5. Adjustments (waivers)

A waiver reduces the collectible amount of an instalment and is recorded
append-only in `financing_adjustments` with a reason and actor.

### 6. Cancel / complete

A non-completed agreement can be cancelled with a reason. When the outstanding
balance reaches zero the agreement is automatically marked `completed` and
ownership transferred.

## Customer workflow

Customers sign in and open **/financing** ("My financing"). They can:

- see their agreements, instalment schedule and payment history;
- **Pay now by M-Pesa** (STK push) for an amount of their choice;
- see the status of any online application;
- start an online application, if enabled.

The product page shows a **"Lipa Mdogo Mdogo: from KES x / week"** callout with a
frequency/term selector, powered by the read-only public quote endpoint.

## M-Pesa

Financing reuses the existing Daraja client (`server/mpesa.ts`). The account
reference sent to Safaricom is `HP<agreementId>` (kept within the 12-character
limit).

Key rules:

- Starting an STK push does **not** mark anything as paid. A payment stays
  `initiated`/`pending` until Safaricom calls back.
- The callback is idempotent on `checkout_request_id` and the M-Pesa receipt.
- The `/api/mpesa/callback` handler routes financing checkouts to
  `applyMpesaCallback` **before** ordinary order handling.
- If the callback cannot be processed yet it returns a retryable error so
  Safaricom retries.

## Notifications

Financing emits these notification events (configurable in
**Settings → Notifications**):

- `financing.agreement.created`
- `financing.agreement.completed`
- `financing.payment.received`
- `financing.payment.overdue`

Notification failures are logged and never block a payment or approval.

## Permissions

| Permission | Grants |
| --- | --- |
| `financing:view` | See the financing console, agreements, stats and reports. |
| `financing:manage` | Create/edit/submit applications, release product, cancel. |
| `financing:approve` | Approve or reject applications. |
| `financing:payment` | Record/reverse payments, adjustments, STK push. |

Admins and owners hold all four; managers hold view/manage/payment by default.

## Database

| Table | Purpose |
| --- | --- |
| `financing_applications` | Requests before an agreement exists. |
| `financing_agreements` | The hire-purchase contract and running totals. |
| `financing_agreement_items` | Line items on an agreement. |
| `financing_schedules` | One row per instalment. |
| `financing_payments` | Payment attempts/records. |
| `financing_payment_allocations` | Which payment paid which instalment. |
| `financing_adjustments` | Append-only waivers/reversals/refunds. |
| `financing_events` | Audit/event log for the module. |

Application numbers are `LIPA-APP-######`; agreement numbers are
`LIPA-AG-######` (sequences start at 1001).

## API reference (staff unless noted)

```
GET    /api/financing/options                 # public read-only
GET    /api/financing/public/quote            # public read-only (productId)
GET    /api/financing/config
PUT    /api/financing/config
GET    /api/financing/stats
POST   /api/financing/refresh-overdue
POST   /api/financing/quote
GET    /api/financing/applications
POST   /api/financing/applications
GET    /api/financing/applications/:id
PATCH  /api/financing/applications/:id
POST   /api/financing/applications/:id/submit
POST   /api/financing/applications/:id/approve
GET    /api/financing/agreements
GET    /api/financing/agreements/:id
POST   /api/financing/agreements/:id/release
POST   /api/financing/agreements/:id/cancel
POST   /api/financing/agreements/:id/payments
POST   /api/financing/agreements/:id/adjustments
POST   /api/financing/agreements/:id/mpesa
POST   /api/financing/payments/:id/reverse
GET    /api/financing/my/agreements           # customer
GET    /api/financing/my/agreements/:id       # customer
GET    /api/financing/my/applications         # customer
POST   /api/financing/my/applications         # customer
POST   /api/financing/my/agreements/:id/mpesa # customer
```

## Operational notes

- Run **Recalculate overdue** (or schedule `refreshOverdueStatuses`) so
  `pending/due/partially_paid` instalments become `overdue` after their due
  date. This is the trigger used for overdue notifications.
- Rounding is exact: for `10000 / 3` the instalments are `3333, 3333, 3334`.
  The final instalment always absorbs the remainder.
- Monthly schedules use a stable calendar anchor with month-end clamping
  (e.g. the 31st stays the 31st where the month allows).
- Changing configuration does not rewrite existing agreements; their terms were
  snapshotted at approval.

## Current limitations / not yet included

- Printable financing PDFs (agreement, schedule, receipt, statement) are not yet
  generated; the data needed for them is available on the agreement record.
- Dedicated financing reports beyond the console stats are not yet built.
- POS does not yet start a financing plan directly from a cart; staff create the
  application from the financing console.
