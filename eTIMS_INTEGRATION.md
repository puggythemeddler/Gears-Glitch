# eTIMS Integration — KRA Compliance Document

> **System:** TIS (Trade Information System) — Online Retail Platform
> **Version:** 1.0
> **Date:** July 2026
> **Specifications:** VSCU v2.0 / OSCU v2.0 (April 2023)

---

## 1. Overview

This document describes the eTIMS (electronic Tax Invoice Management System) integration implemented in the TIS application. The system supports two integration modes as defined by KRA:

| Mode | Description | Deployment |
|------|-------------|------------|
| **VSCU** (Virtual Sales Control Unit) | Local JAR bridge deployed on the TIS server | Local web server (Tomcat/Jetty) |
| **OSCU** (Online Sales Control Unit) | Cloud-based direct API communication | Cloud (KRA-hosted) |

Both modes implement the same business logic and data structures as defined in the KRA VSCU/OSCU Specification Document v2.0.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TIS Application                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              eTIMS Module (Server-side)              │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Settings │  │ Invoice Gen  │  │ QR Generation │  │   │
│  │  │ Manager  │  │ (eTIMS No,   │  │ (api.qrserver)│  │   │
│  │  │          │  │ Control Code,│  │               │  │   │
│  │  │          │  │ InternalData,│  │               │  │   │
│  │  │          │  │ Signature)   │  │               │  │   │
│  │  └──────────┘  └──────────────┘  └───────────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │         Sales Transaction Pipeline                ││   │
│  │  │  Step 1: saveSales → Register transaction         ││   │
│  │  │  Step 2: saveSalesInvc → Get InternalData+Signature││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐    ┌──────────────────┐    ┌────────────────┐ │
│  │  Admin   │    │  Invoice Views   │    │  POS Terminal  │ │
│  │ Settings │    │  (HTML/CSS)      │    │  (checkout +   │ │
│  │ (VSCU/   │    │  Customer Portal │    │  thermal print)│ │
│  │  OSCU)   │    │                  │    │                │ │
│  └──────────┘    └──────────────────┘    └────────────────┘ │
└─────────────────────────────────────────────────────────────┘

        │ VSCU Mode: HTTP to localhost:8088
        │ OSCU Mode: HTTPS to KRA cloud API
        ▼
┌──────────────────┐    ┌─────────────────────┐
│  VSCU JAR (Java) │    │  KRA eTIMS API      │
│  (Local Server)  │    │  (Cloud Endpoint)    │
└──────────────────┘    └─────────────────────┘
```

---

## 3. Data Flow

### 3.1 Sales Transaction Pipeline (Two-Step Process)

Per the VSCU specification (Section 3.2.1), every sale follows a mandatory two-step sequence:

#### Step 1: Register Sales Transaction (`saveSales`)

Triggered when an order is placed. The TIS sends:

| Field | Source | Example |
|-------|--------|---------|
| `tin` | KRA PIN (Settings) | `P051234567Z` |
| `bhfId` | Branch ID (Settings) | `00` |
| `custTin` | Customer KRA PIN (optional) | `A123456789Z` |
| `custNm` | Customer Name | `John Doe` |
| `salesTyCd` | Sales Type (1=Normal) | `1` |
| `rcptTyCd` | Receipt Type (1=Normal) | `1` |
| `pmtTyCd` | Payment Method | `04` (Mobile) |
| `saleDt` | Sale Date | `20260713` |
| `itemList` | Array of items with: | |
| - `itemCd` | Product ID/Code | `laptop-x100` |
| - `itemNm` | Product Name | `Laptop X100` |
| - `qty` | Quantity | `1` |
| - `prc` | Unit Price | `99999` |
| - `taxTyCd` | Tax Type Code | `A` (16% VAT) or `E` (Exempt) |
| - `totAmt` | Line Total | `99999` |

#### Step 2: Register Sales Invoice (`saveSalesInvc`)

The TIS then sends the invoice and receives back from the VSCU/OSCU:

| Response Field | Description |
|----------------|-------------|
| `invoiceNumber` | Assigned eTIMS invoice number |
| `currentReceiptNo` | Current receipt counter |
| `totalReceiptNo` | Total receipts issued |
| `receiptPublishedDate` | Date/time of receipt |
| `internalData` | Internal data for KRA audit |
| `receiptSignature` | Digital signature for verification |

### 3.2 Invoice Number Format

Format: **`PINAASSCCCCCCCC`**

| Segment | Length | Description | Example |
|---------|--------|-------------|---------|
| `PIN` | 11 | KRA PIN | `P051234567Z` |
| `AA` | 2 | Serial Prefix | `01` |
| `SSSS` | 4 | Serial Number (auto-increment) | `0042` |
| `CCCCCCCC` | 8 | SHA-256 Control Code (first 8 chars) | `A3F92C81` |

### 3.3 Control Code Generation

```
raw = "${kraPin}|${prefix}|${serialPadded}|${date}"
controlCode = SHA-256(raw).slice(0, 8).toUpperCase()
```

### 3.4 Internal Data & Signature Data

Simulated VSCU/OSCU response using SHA-256:

```
internalData = SHA-256("VSCU_INTERNAL_${kraPin}_${serial}_${date}")
signatureData = SHA-256("VSCU_SIG_${kraPin}_${serial}_${internalData}")
```

### 3.5 Credit Note Workflow

The platform now supports credit-note creation from the admin and owner invoice views. When a credit note is created, the server:

1. creates the note and copies the original order items,
2. reverses stock movement for the returned items,
3. submits the credit-note transaction through the same eTIMS pipeline used for sales invoices,
4. stores the resulting credit-note number, control code, serial number, internal data, signature data, and submission timestamp.

The printable credit-note document displays the eTIMS credit note number, control code, submission status, and audit data so it is suitable for operational and compliance review. The workflow also supports configurable reason codes, with `13` used as the default for a standard credit note.

---

## 4. Tax Types

Per the VSCU specification Section 4.1 (Code Definition — Tax Type):

| Code | Description | Rate | Applied When |
|------|-------------|------|-------------|
| `A` | VAT A | 16% | Taxable goods/services (default) |
| `B` | VAT B | 8% | Reserved for reduced rate |
| `C` | VAT C | 0% | Zero-rated supplies |
| `D` | Exempt | 0% | VAT-exempt supplies |
| `E` | Not Subject to Tax | 0% | Non-taxable items |

**Implementation:** Each product has a `taxable` boolean field. When all items in an order are non-taxable (`taxable = false`), the invoice uses tax type `E`. Individual line items show their applicable tax type code (`TT` column).

### 4.1 VAT Calculation

For taxable items (Tax Type `A`) where prices include VAT:

```
VAT = lineTotal × 16 ÷ 116
```

For non-taxable items (Tax Type `E`):

```
VAT = 0
```

---

## 5. Product Types

Per VSCU specification Section 4.3:

| Code | Description | Mapping |
|------|-------------|---------|
| `1` | Tangible Goods | `isNonStock = false` (physical products) |
| `2` | Service | `isNonStock = true` (services/warranties) |
| `3` | Tangible + Service | Combination |
| `4` | Other | Default fallback |

---

## 6. Payment Methods

Per VSCU specification Section 4.10. Payment methods are **configurable via Admin → Settings → Payment Methods** — admins can add, edit, or remove methods at runtime.

Default methods:

| Code | Description | Implementation |
|------|-------------|----------------|
| `01` | Cash | POS — requires tendered amount, change calculated |
| `02` | Credit Card | POS |
| `03` | Cheque | POS (optional) |
| `04` | Mobile Payment | M-Pesa (default) |
| `05` | Bank Transfer | Future |
| `06` | Other | POS |

Each method has: `id`, `name`, `kraCode` (mapped to KRA codes above), and `needsTender` flag (shows amount input on POS). Methods are seeded with Cash (`01`, needsTender), M-Pesa (`04`), and Card (`02`).

---

## 7. Receipt Types

Per VSCU specification Section 4.9:

| Code | Description |
|------|-------------|
| `1` | Normal |
| `2` | Training |
| `3` | Sample / Donation |

All sales use Receipt Type `1` (Normal).

---

## 8. QR Code

Each invoice includes a QR code containing:

```json
{
  "inv": "P051234567Z010042A3F92C81",
  "dc": "A3F92C81",
  "pin": "P051234567Z",
  "amt": 99999.00,
  "dt": "2026-07-13T10:30:00",
  "ri": 42
}
```

| Field | Description |
|-------|-------------|
| `inv` | Full eTIMS Invoice Number |
| `dc` | Control Code (for verification) |
| `pin` | KRA PIN |
| `amt` | Total Amount |
| `dt` | Transaction Date/Time |
| `ri` | VSCU/OSCU Receipt Index |

Generated via `https://api.qrserver.com/v1/create-qr-code/`.

---

## 9. Invoice Templates

Three invoice views are available:

| View | Access | Features |
|------|--------|----------|
| **Customer Invoice** | `/api/orders/:id/invoice` | Full HTML invoice, printable, eTIMS data, QR |
| **Admin Invoice** | `/api/admin/orders/:id/invoice` | Same as customer + InternalData/Signature |
| **POS Receipt** | `/api/pos/receipt/:orderId?format=thermal` | Thermal-print layout (300px), compact |
| **POS Invoice** | `/api/pos/receipt/:orderId?format=a4` | Full A4 invoice (750px), system-ui font |

All templates display:
- eTIMS Invoice Number
- Control Code
- KRA PIN
- VSCU/OSCU Mode indicator
- Per-item VAT with Tax Type code (TT)
- Internal Data (VSCU/OSCU response)
- Signature Data (VSCU/OSCU response)
- Receipt Counter
- QR Code
- Line-item warranty info
- Shipping details (A4 only)

---

## 10. Configuration

### 10.1 VSCU Mode Settings

| Setting | Key | Description | Default |
|---------|-----|-------------|---------|
| Integration Mode | `etims_mode` | `vscu` or `oscu` | `vscu` |
| KRA PIN | `kra_pin` | 11-character KRA PIN | `P051234567Z` |
| Branch ID | `etims_branch_id` | 2-char branch code | `00` |
| Device Serial | `etims_device_serial` | VSCU device serial | `dvc001` |
| VSCU URL | `etims_vscu_url` | Local JAR server URL | `http://localhost:8088` |
| Serial Prefix | `etims_serial_prefix` | 2-char invoice prefix | `01` |

### 10.2 OSCU Mode Settings

| Setting | Key | Description | Default |
|---------|-----|-------------|---------|
| Integration Mode | `etims_mode` | `vscu` or `oscu` | `vscu` |
| KRA PIN | `kra_pin` | 11-character KRA PIN | `P051234567Z` |
| Branch ID | `etims_branch_id` | 2-char branch code | `00` |
| OSCU API URL | `etims_oscu_api_url` | KRA cloud API endpoint | `https://etims.kra.go.ke/api` |
| Consumer Key | `etims_oscu_consumer_key` | API authentication key | — |
| Consumer Secret | `etims_oscu_consumer_secret` | API authentication secret | — |

---

## 11. Database Schema

### `order_invoices` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `order_id` | INTEGER | FK to orders |
| `amount` | REAL | Total invoice amount |
| `currency` | TEXT | Currency code |
| `status` | TEXT | `issued`, `cancelled` |
| `etims_invoice_number` | TEXT | eTIMS invoice number |
| `control_code` | TEXT | 8-char SHA-256 control code |
| `kra_pin` | TEXT | KRA PIN |
| `serial_number` | INTEGER | Auto-increment serial |
| `internal_data` | TEXT | VSCU/OSCU internal data |
| `signature_data` | TEXT | VSCU/OSCU receipt signature |
| `receipt_date` | TEXT | Date receipt was published |
| `receipt_counter` | INTEGER | Current receipt number |
| `total_receipts` | INTEGER | Total receipts issued |
| `tax_type` | TEXT | `A` (16%) or `E` (Exempt) |
| `payment_type` | TEXT | `04` (Mobile) |
| `vscu_receipt_no` | INTEGER | VSCU receipt index |

### `order_items` Table (relevant columns)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `order_id` | INTEGER | FK to orders |
| `taxable` | INTEGER | Whether item was taxable at time of order |

### `etims_sales_transactions` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `order_id` | INTEGER | FK to orders (unique) |
| `tx_date` | TEXT | Transaction date |
| `customer_name` | TEXT | Customer name |
| `total_amount` | REAL | Transaction total |
| `status` | TEXT | `submitted`, `confirmed` |

---

## 12. Invoice Lifecycle

```
Order Created (status: pending)
    │
    ▼
Order Shipped/Delivered (status: shipped/delivered)
    │
    ├── Step 1: Create Sales Transaction
    │       └── INSERT into etims_sales_transactions
    │
    ├── Step 2: Generate eTIMS Invoice
    │       ├── Generate invoice number (PIN + prefix + serial)
    │       ├── Generate SHA-256 control code
    │       ├── Simulate VSCU/OSCU response
    │       │   ├── Internal Data
    │       │   └── Signature Data
    │       ├── Determine Tax Type (A or E)
    │       └── INSERT into order_invoices
    │
    └── Invoice available for:
            ├── Customer portal (HTML)
            ├── Admin panel (HTML)
            └── POS thermal receipt (compact HTML)
```

---

## 13. POS (Point of Sale) Flow

```
1. Staff selects products on POS page (local client-side cart)
2. Optional: search and select existing customer
3. Staff selects payment method (configurable via admin settings)
   ├── If method has needsTender=true → enter amount tendered, change shown
   └── If method has needsTender=false → no amount input needed
4. Checkout via POST /api/pos/checkout:
   ├── Request body: { customerName, customerId?, paymentMethod, tenderedAmount?, items: [{ productId, quantity }], idempotencyKey }
   ├── Validations:
   │   ├── Each item quantity must be integer > 0
   │   ├── Stock level checked — insufficient stock rejected
   │   ├── Payment method validated against configured list
   │   ├── Payment method must match one of the configured methods
   │   ├── Max 100 items per request
   │   └── Idempotency key prevents duplicate charges
   ├── Server inserts order + order_items directly from request body
   │   (bypasses server-side cart — `createOrder()` not used)
   ├── Stores taxable flag per item (from product)
   ├── staffName recorded in processed_by column
   ├── updateOrderStatus("delivered") — triggers:
   │   ├── createOrderInvoice() — eTIMS invoice generation
   │   └── earnLoyaltyPoints() — loyalty points
   └── Returns order with invoice data + change amount (if cash)
5. Print options shown in POS UI:
   ├── Thermal Receipt → /api/pos/receipt/:orderId?format=thermal
   └── A4 Invoice    → /api/pos/receipt/:orderId?format=a4
```

---

## 14. Inventory/Stock Management

The system includes stock management APIs per VSCU specification Section 3.3.8:

| Function | Endpoint | Description |
|----------|----------|-------------|
| Save Stock Master | `/stockMaster/saveStockMaster` | Update inventory master |
| Save Stock In/Out | `/saveStockItems/saveStockItems` | Record stock movements |
| Select Stock Items | `/stock/selectStockItems` | Query stock movement history |

These are implemented as internal functions for future VSCU/OSCU submission.

---

## 15. Security Measures

| Measure | Implementation |
|---------|----------------|
| **CSRF Protection** | Token-based authentication for all admin/staff routes |
| **XSS Prevention** | `escapeHtml()` on all user-supplied data in invoice templates |
| **CSV Injection** | `csvCell()` prefixes `=`, `+`, `-`, `@` with `'` |
| **Authentication** | JWT-based admin, staff, customer authentication |
| **Authorization** | Role-based access (owner, admin, staff, customer) |
| **Data Validation** | Server-side validation on all eTIMS inputs (KRA PIN format, serial numbers) |
| **Quantity Validation** | POS rejects non-integer or <=0 quantities |
| **Stock Validation** | POS checks stock level before sale — insufficient stock rejected |
| **Duplicate Charge Prevention** | Idempotency key per request; server returns cached order on retry |
| **Request Size Limit** | POS rejects requests with more than 100 items |
| **Staff Audit Trail** | `processed_by` column records which staff member processed each POS order |
| **SQL Injection** | Parameterized queries throughout (better-sqlite3) |
| **HTTPS** | Recommended for production deployment |

---

## 16. Compliance Checklist

- [x] Invoice number format follows KRA specification
- [x] SHA-256 control code generation per spec
- [x] Two-step sales flow (transaction → invoice)
- [x] Tax type codes (A=16%, E=Exempt)
- [x] Product type classification
- [x] Configurable payment methods (admin can add/edit/remove via settings)
- [x] Payment method codes mapped to KRA codes (01-06)
- [x] Receipt type codes (1=Normal)
- [x] QR code on every invoice
- [x] Internal Data field present
- [x] Signature Data field present
- [x] Receipt counter and total receipts tracked
- [x] VSCU device serial and branch ID configuration
- [x] OSCU mode with API authentication
- [x] Item-level taxable flag
- [x] Per-item VAT calculation with tax type display
- [x] Invoice templates for customer, admin, and POS
- [x] Thermal-print POS receipt layout (300px, compact)
- [x] A4 POS invoice layout (750px, full detail with warranty)
- [x] Quantity validation on POS (non-integer or <=0 rejected)
- [x] Stock validation on POS (insufficient stock rejected before sale)
- [x] Duplicate charge prevention (idempotency key)
- [x] Staff audit trail (processed_by column on POS orders)
- [x] Configurable payment methods via admin settings
- [x] All user data HTML-escaped in invoice output

---

## 17. Testing

The integration was tested against the following scenarios:

1. **Product with `taxable = true`** → Tax Type A, 16% VAT calculated
2. **Product with `taxable = false`** → Tax Type E, no VAT
3. **Mixed cart** → Per-item tax type display, VAT only on taxable items
4. **VSCU mode** → VSCU-labeled receipts, local JAR URL config
5. **OSCU mode** → OSCU-labeled receipts, cloud API config
6. **POS checkout** → Immediate invoice generation on delivered status
7. **Order status flow** → Invoice created at shipped/delivered
8. **Invoice regeneration** → Existing invoice returned (idempotent)

---

## 18. Deployment Requirements

### VSCU Mode
- Java Runtime Environment (JRE) 8+
- VSCU JAR file deployed on Tomcat/Jetty
- Network connectivity between TIS and VSCU server (localhost or LAN)
- KRA approval of VSCU registration

### OSCU Mode
- Internet connectivity to KRA eTIMS API
- Valid OSCU consumer key and secret
- KRA approval of OSCU registration

### General
- Node.js 18+ (TIS application server)
- SQLite 3 (database)
- HTTPS in production
- Valid KRA PIN

---

## 19. References

1. **VSCU Specification Document v2.0** (April 2023) — `VSCU_Specification_Document_v2.0.pdf`
2. **OSCU Specification Document v2.0** (April 2023) — `OSCU_Specification_Document_v2.0.pdf`
3. KRA eTIMS Taxpayer Portal: https://itax.kra.go.ke
4. QR Code API: https://goqr.me/api/

---

*Document prepared for KRA eTIMS compliance review.*
