// ─────────────────────────────────────────────────────────────────────────────
// reporting.ts — Shared reporting foundation for the client app.
//
// Single source of truth for:
//   • report date ranges (validated ISO, inclusive `to`) and comparison periods
//   • the canonical net-revenue aggregate used by every sales-family report
//   • trend series and breakdowns (product/category/group/branch/staff/payment/
//     customer/channel/hour/day-of-week)
//   • server-side CSV export with formula-injection guard + UTF-8 BOM
//   • "how this is calculated" definitions surfaced to the UI
//
// Net Sales = Gross Sales − Discounts − Gift-card redemptions − Refunds
// Gross Sales = Σ(non-cancelled order line revenue) + shipping fees, for
// orders whose status is not `cancelled`. Refunds use the authoritative
// per-order `amount_refunded` total recorded by the refund flow.
// ─────────────────────────────────────────────────────────────────────────────
import { queryAll, queryOne } from "./db-helpers";
import type { Response } from "express";

// ─── Date ranges ────────────────────────────────────────────────────────────

export interface DateRange {
  /** Inclusive first day (ISO yyyy-mm-dd). */
  from: string;
  /** Inclusive last day (ISO yyyy-mm-dd). */
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a report date range. Bounds must be ISO yyyy-mm-dd and from <= to.
 * `to` is an inclusive full day — all range queries use
 * `created_at >= :from AND created_at < (:to + 1 day)`, evaluated in the
 * database server's time zone (matching the existing trend/range behavior).
 */
export function parseDateRange(fromRaw: unknown, toRaw: unknown): DateRange | null {
  const from = String(fromRaw ?? "").trim();
  const to = String(toRaw ?? "").trim();
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return null;
  const f = Date.parse(`${from}T00:00:00.000Z`);
  const t = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(f) || !Number.isFinite(t)) return null;
  if (f > t) return null;
  return { from, to };
}

export function allTimeRange(): DateRange {
  return { from: "1970-01-01", to: "2099-12-31" };
}

/** Last `n` whole days ending today (inclusive). */
export function lastNDays(n: number, now = new Date()): DateRange {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (n - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

/** The equivalent-length period immediately before `range`. */
export function previousPeriod(range: DateRange): DateRange {
  const day = 24 * 60 * 60 * 1000;
  const f = Date.parse(`${range.from}T00:00:00.000Z`);
  const t = Date.parse(`${range.to}T00:00:00.000Z`);
  const len = Math.round((t - f) / day) + 1; // inclusive days
  const prevTo = new Date(f - day);
  const prevFrom = new Date(f - day * len);
  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDays(range: DateRange, days: number): DateRange {
  return { from: shift(range.from, days), to: shift(range.to, days) };
}
function shift(iso: string, days: number): string {
  return isoDay(new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000));
}

// ─── Order filters → SQL ────────────────────────────────────────────────────

export interface OrderFilter {
  from?: string;
  to?: string;
  branchId?: number;
  staffId?: number;
  paymentMethod?: string;
  source?: string;
  customerId?: number;
  productId?: string;
  groupId?: string;
  category?: string;
  /** Sales semantics: exclude cancelled orders. Default true. */
  excludeCancelled?: boolean;
  /** Also count refunded/cancelled lines? Only relevant when excludeCancelled. */
}

export interface BuiltWhere {
  /** WHERE conditions joined on `o.`-qualified columns. Prefixed by caller. */
  where: string;
  params: any[];
}

/**
 * Build a WHERE clause on the `o` (orders) alias. `startIdx` lets callers chain
 * additional parameters. Always used together with `FROM orders o`.
 */
export function buildOrderWhere(filter: OrderFilter, startIdx = 1): BuiltWhere {
  const conds: string[] = [];
  const params: any[] = [];
  let idx = startIdx;
  if (filter.excludeCancelled !== false) conds.push("o.status != 'cancelled'");
  if (filter.from) { conds.push(`o.created_at::timestamp >= $${idx}`); params.push(filter.from); idx++; }
  if (filter.to) { conds.push(`o.created_at::timestamp < ($${idx}::date + interval '1 day')`); params.push(filter.to); idx++; }
  if (filter.branchId) { conds.push(`o.branch_id = $${idx}`); params.push(filter.branchId); idx++; }
  if (filter.staffId) { conds.push(`o.staff_id = $${idx}`); params.push(filter.staffId); idx++; }
  if (filter.paymentMethod) { conds.push(`LOWER(o.payment_method) = LOWER($${idx})`); params.push(filter.paymentMethod); idx++; }
  if (filter.source) { conds.push(`o.source = $${idx}`); params.push(filter.source); idx++; }
  if (filter.customerId) { conds.push(`o.customer_id = $${idx}`); params.push(filter.customerId); idx++; }
  if (filter.productId) {
    conds.push(`EXISTS (SELECT 1 FROM order_items oi_p WHERE oi_p.order_id = o.id AND oi_p.product_id = $${idx} AND oi_p.cancelled = 0)`);
    params.push(filter.productId); idx++;
  }
  if (filter.groupId) {
    conds.push(`EXISTS (SELECT 1 FROM order_items oi_g JOIN products p_g ON p_g.id = oi_g.product_id WHERE oi_g.order_id = o.id AND p_g.group_id = $${idx} AND oi_g.cancelled = 0)`);
    params.push(filter.groupId); idx++;
  }
  if (filter.category) {
    conds.push(`EXISTS (SELECT 1 FROM order_items oi_c JOIN products p_c ON p_c.id = oi_c.product_id WHERE oi_c.order_id = o.id AND LOWER(p_c.category) = LOWER($${idx}) AND oi_c.cancelled = 0)`);
    params.push(filter.category); idx++;
  }
  return { where: conds.length ? conds.join(" AND ") : "TRUE", params };
}

const LINE_JOIN = `
  LEFT JOIN (
    SELECT oi.order_id,
           SUM(oi.price * oi.quantity) AS line_revenue,
           SUM(oi.quantity) AS units
    FROM order_items oi WHERE oi.cancelled = 0
    GROUP BY oi.order_id
  ) li ON li.order_id = o.id`;

// ─── Canonical sales totals ─────────────────────────────────────────────────

export interface SalesTotals {
  orders: number;
  gross_sales: number;
  shipping: number;
  discounts: number;
  gift_cards: number;
  refunds: number;
  net_sales: number;
  items_sold: number;
  aov: number; // gross / orders
  units_per_order: number; // items / orders
}

export async function salesTotals(filter: OrderFilter = {}): Promise<SalesTotals> {
  const { where, params } = buildOrderWhere(filter);
  const row = await queryOne(
    `SELECT
       COUNT(*)::int AS orders,
       COALESCE(SUM(li.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0) AS gross_sales,
       COALESCE(SUM(o.shipping_fee), 0) AS shipping,
       COALESCE(SUM(o.discount_amount), 0) AS discounts,
       COALESCE(SUM(o.gift_card_amount), 0) AS gift_cards,
       COALESCE(SUM(o.amount_refunded), 0) AS refunds,
       (COALESCE(SUM(li.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0))
         - COALESCE(SUM(o.discount_amount), 0)
         - COALESCE(SUM(o.gift_card_amount), 0)
         - COALESCE(SUM(o.amount_refunded), 0) AS net_sales,
       COALESCE(SUM(li.units), 0) AS items_sold
     FROM orders o${LINE_JOIN}
     WHERE ${where}`,
    params
  ) as any;
  const orders = Number(row?.orders || 0);
  const gross = Number(row?.gross_sales || 0);
  return {
    orders,
    gross_sales: gross,
    shipping: Number(row?.shipping || 0),
    discounts: Number(row?.discounts || 0),
    gift_cards: Number(row?.gift_cards || 0),
    refunds: Number(row?.refunds || 0),
    net_sales: Number(row?.net_sales || 0),
    items_sold: Number(row?.items_sold || 0),
    aov: orders ? gross / orders : 0,
    units_per_order: orders ? Number(row?.items_sold || 0) / orders : 0,
  };
}

export type Granularity = "day" | "week" | "month";

export interface SeriesPoint extends SalesTotals {
  bucket: string;
}

/** Daily/weekly/monthly sales series over a filter. */
export async function salesSeries(filter: OrderFilter, granularity: Granularity = "day"): Promise<SeriesPoint[]> {
  const { where, params } = buildOrderWhere(filter);
  const bucketExpr =
    granularity === "month" ? "date_trunc('month', o.created_at::timestamp)::date"
    : granularity === "week" ? "date_trunc('week', o.created_at::timestamp)::date"
    : "DATE(o.created_at::timestamp)";
  const rows = await queryAll(
    `SELECT ${bucketExpr} AS bucket,
       COUNT(*)::int AS orders,
       COALESCE(SUM(li.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0) AS gross_sales,
       COALESCE(SUM(o.shipping_fee), 0) AS shipping,
       COALESCE(SUM(o.discount_amount), 0) AS discounts,
       COALESCE(SUM(o.gift_card_amount), 0) AS gift_cards,
       COALESCE(SUM(o.amount_refunded), 0) AS refunds,
       (COALESCE(SUM(li.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0))
         - COALESCE(SUM(o.discount_amount), 0)
         - COALESCE(SUM(o.gift_card_amount), 0)
         - COALESCE(SUM(o.amount_refunded), 0) AS net_sales,
       COALESCE(SUM(li.units), 0) AS items_sold
     FROM orders o${LINE_JOIN}
     WHERE ${where}
     GROUP BY bucket ORDER BY bucket`,
    params
  );
  return (rows || []).map((r: any) => {
    const orders = Number(r.orders || 0);
    const gross = Number(r.gross_sales || 0);
    const items = Number(r.items_sold || 0);
    return {
      bucket: String(r.bucket || "").slice(0, 10),
      orders,
      gross_sales: gross,
      shipping: Number(r.shipping || 0),
      discounts: Number(r.discounts || 0),
      gift_cards: Number(r.gift_cards || 0),
      refunds: Number(r.refunds || 0),
      net_sales: Number(r.net_sales || 0),
      items_sold: items,
      aov: orders ? gross / orders : 0,
      units_per_order: orders ? items / orders : 0,
    };
  });
}

// ─── Breakdowns ─────────────────────────────────────────────────────────────

export type SalesBreakdownBy =
  | "product" | "category" | "group" | "branch" | "staff" | "payment_method"
  | "customer" | "channel" | "hour" | "dow" | "day";

export interface BreakdownRow {
  id: string | number;
  label: string;
  orders: number;
  items_sold: number;
  revenue: number;
  net: number;
  share_pct: number | null;
}

/**
 * Total revenue by a chosen dimension. `revenue` mirrors the go-forward gross
 * definition (line items + shipping); `net` further subtracts discounts/gift
 * cards/refunds attributed per order.
 */
export async function salesBreakdown(filter: OrderFilter, by: SalesBreakdownBy): Promise<BreakdownRow[]> {
  const { where, params } = buildOrderWhere(filter);

  // Whole-order dimensions map one order to exactly one row, so shipping and
  // order-level discounts/gift-cards/refunds can be attributed correctly.
  // Line-level dimensions (product/category/group) cannot attribute shipping
  // or order discounts per line, so they report line revenue only and net == revenue.
  interface Dim { select: string; join: string; group: string; orderLevel: boolean }
  // Same canonical form as normalizePaymentMethod (lowercase, non-alphanumerics
  // stripped) so write-side variants like "M-Pesa"/" mpesa "/"MPESA" share one
  // bucket instead of fragmenting into m-pesa vs mpesa groups.
  const pmNorm = `regexp_replace(LOWER(TRIM(o.payment_method)), '[^a-z0-9]', '', 'g')`;
  const dim: Record<SalesBreakdownBy, Dim> = {
    product: {
      select: "oi.product_id AS id, oi.name AS label",
      join: "JOIN order_items oi ON oi.order_id = o.id AND oi.cancelled = 0",
      group: "oi.product_id, oi.name",
      orderLevel: false,
    },
    category: {
      select: "COALESCE(NULLIF(pc.category,''),'Uncategorised') AS label, COALESCE(NULLIF(pc.category,''),'') AS id",
      join: "JOIN order_items oi ON oi.order_id = o.id AND oi.cancelled = 0 LEFT JOIN products pc ON pc.id = oi.product_id",
      group: "pc.category",
      orderLevel: false,
    },
    group: {
      select: "COALESCE(NULLIF(pg.name,''),'Ungrouped') AS label, COALESCE(pg.id::text,'') AS id",
      join: "JOIN order_items oi ON oi.order_id = o.id AND oi.cancelled = 0 LEFT JOIN products pp ON pp.id = oi.product_id LEFT JOIN product_groups pg ON pg.id = pp.group_id",
      group: "pg.id, pg.name",
      orderLevel: false,
    },
    branch: {
      select: "COALESCE(NULLIF(b.name,''),'Main Branch') AS label, COALESCE(b.id::text,'') AS id",
      join: "LEFT JOIN branches b ON b.id = o.branch_id",
      group: "b.id, b.name",
      orderLevel: true,
    },
    staff: {
      select: "COALESCE(NULLIF(u.username,''),'Unassigned') AS label, COALESCE(u.id::text,'') AS id",
      join: "LEFT JOIN users u ON u.id = o.staff_id",
      group: "u.id, u.username",
      orderLevel: true,
    },
    payment_method: {
      select: `COALESCE(NULLIF(${pmNorm},''),'unrecorded') AS label, COALESCE(NULLIF(${pmNorm},''),'unrecorded') AS id`,
      join: "",
      group: `COALESCE(${pmNorm},'')`,
      orderLevel: true,
    },
    customer: {
      select: "COALESCE(NULLIF(c.name,''),'Walk-in') AS label, COALESCE(c.id::text,'') AS id",
      join: "LEFT JOIN customers c ON c.id = o.customer_id",
      group: "c.id, c.name",
      orderLevel: true,
    },
    channel: {
      select: "COALESCE(NULLIF(o.source,''),'storefront') AS label, COALESCE(NULLIF(o.source,''),'') AS id",
      join: "",
      group: "o.source",
      orderLevel: true,
    },
    hour: {
      select: "EXTRACT(HOUR FROM o.created_at::timestamp)::int AS id, TO_CHAR(o.created_at::timestamp, 'HH24:00') AS label",
      join: "",
      group: "EXTRACT(HOUR FROM o.created_at::timestamp)",
      orderLevel: true,
    },
    dow: {
      select: "EXTRACT(DOW FROM o.created_at::timestamp)::int AS id, TO_CHAR(o.created_at::timestamp, 'Dy') AS label",
      join: "",
      group: "EXTRACT(DOW FROM o.created_at::timestamp)",
      orderLevel: true,
    },
    day: {
      select: "DATE(o.created_at::timestamp)::text AS id, TO_CHAR(o.created_at::timestamp, 'YYYY-MM-DD') AS label",
      join: "",
      group: "DATE(o.created_at::timestamp)",
      orderLevel: true,
    },
  };

  const d = dim[by];
  const LINE_AGG = `LEFT JOIN (
      SELECT order_id, SUM(price * quantity) AS line_revenue, SUM(quantity) AS units
      FROM order_items WHERE cancelled = 0 GROUP BY order_id
    ) oi ON oi.order_id = o.id`;

  if (d.orderLevel) {
    const revenueExpr = `COALESCE(SUM(oi.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0)`;
    const netExpr = `(${revenueExpr} - COALESCE(SUM(o.discount_amount), 0) - COALESCE(SUM(o.gift_card_amount), 0) - COALESCE(SUM(o.amount_refunded), 0))`;
    const rows = await queryAll(
      `SELECT ${d.select},
         COUNT(*)::int AS orders,
         COALESCE(SUM(oi.units), 0) AS items_sold,
         ${revenueExpr} AS revenue,
         ${netExpr} AS net
       FROM orders o ${d.join} ${LINE_AGG}
       WHERE ${where}
       GROUP BY ${d.group} ORDER BY revenue DESC`,
      params
    );
    return toBreakdown(rows ?? []);
  }

  const rows = await queryAll(
    `SELECT ${d.select},
       COUNT(*)::int AS orders,
       COALESCE(SUM(oi.quantity), 0) AS items_sold,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS net
     FROM orders o ${d.join}
     WHERE ${where}
     GROUP BY ${d.group} ORDER BY revenue DESC`,
    params
  );

  return toBreakdown(rows ?? []);
}

function toBreakdown(rows: any[]): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  let totalRev = 0;
  for (const r of rows) totalRev += Number(r.revenue || 0);
  for (const r of rows) {
    const revenue = Number(r.revenue || 0);
    out.push({
      id: r.id,
      label: String(r.label || "—"),
      orders: Number(r.orders || 0),
      items_sold: Number(r.items_sold || 0),
      revenue,
      net: Number(r.net || 0),
      share_pct: totalRev > 0 ? (revenue / totalRev) * 100 : null,
    });
  }
  return out;
}

// ─── Comparison ─────────────────────────────────────────────────────────────

export interface ComparisonResult {
  current: SalesTotals;
  previous: SalesTotals;
  abs_change: number; // net current − net previous
  pct_change: number | null;
}

/** Compare a period's net sales with the equivalent previous period. */
export async function salesComparison(filter: OrderFilter, range: DateRange): Promise<ComparisonResult | null> {
  const prevFilter: OrderFilter = { ...filter, from: undefined, to: undefined, ...previousPeriod(range) };
  const currentFilter: OrderFilter = { ...filter, from: range.from, to: range.to };
  const [current, previous] = await Promise.all([salesTotals(currentFilter), salesTotals(prevFilter)]);
  return {
    current,
    previous,
    abs_change: current.net_sales - previous.net_sales,
    pct_change: previous.net_sales !== 0 ? ((current.net_sales - previous.net_sales) / previous.net_sales) * 100 : null,
  };
}

// ─── CSV export ─────────────────────────────────────────────────────────────

export interface CsvColumn {
  key: string;
  label: string;
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (s.length && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly Record<string, unknown>[], columns?: CsvColumn[]): string {
  if (!columns || columns.length === 0) {
    if (rows.length === 0) return "";
    columns = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  }
  const head = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) => columns!.map((c) => csvCell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

/** Send a CSV download. Filename is sanitized (safe HTTP header value). */
export function sendCsv(res: Response, filename: string, csv: string): void {
  const safe = filename.replace(/[^\w.\-]/g, "_");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
  res.send(`\uFEFF${csv}`);
}

// ─── Formulas / definitions (surfaced to the UI) ────────────────────────────

export const REPORT_FORMULAS: Record<string, string> = {
  net_sales: "Net Sales = Gross Sales − Discounts − Gift-card redemptions − Refunds.",
  gross_sales: "Gross Sales = Σ(paid-for order lines: price × qty) + shipping fees, on non-cancelled orders.",
  discounts: "Discounts = Σ orders.discount_amount over the period (coupons + manual discounts).",
  gift_cards: "Gift-card redemptions = Σ orders.gift_card_amount over the period.",
  refunds: "Refunds = Σ orders.amount_refunded over the period (authoritative refund total recorded by the refund flow).",
  aov: "Average order value = Gross Sales ÷ Orders.",
  "units_per_order": "Units per order = Items sold ÷ Orders.",
  profit_gross: "Gross Profit = Revenue − COGS. COGS uses the product cost captured on each order line (products.cost_price at sale time). Lines without a recorded cost are excluded from profit and reported as 'cost data incomplete'.",
  margin: "Gross margin % = Gross Profit ÷ Revenue, computed over lines with a cost basis only.",
  stock_value_cost: "Stock value (cost) = Σ units on hand × products.cost_price, only where a cost is recorded.",
  stock_value_retail: "Stock value (retail) = Σ units on hand × products.price.",
  warranty_claim_rate: "Warranty claim rate = Claims ÷ Units sold (only where the sold population is reliable).",
  conversion: "Conversion rates are computed only from actually tracked events (page views → product views → add-to-cart → checkout → order).",
  turnaround: "Average turnaround = Σ(completed_at − created_at) ÷ repairs collected, using recorded completed_at timestamps.",
};

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}