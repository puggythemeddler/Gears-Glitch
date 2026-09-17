// ─────────────────────────────────────────────────────────────────────────────
// report-routes.ts — addititive reporting endpoints (Phase 3/4).
//
// Every query is tenant-isolated by construction: this app runs one PostgreSQL
// database per tenant, so all dead-row reads happen inside the tenant DB. All
// routes require an authenticated staff/admin session (ownerAuthMiddleware) plus
// reports:view; the /export.csv routes additionally require reports:export —
// the permission is now enforced server-side, and every export passes through
// the formula-injection-guarded CSV writer from reporting.ts.
//
// None of these endpoints fabricate data: every metric documents what it counts
// and anything not reliably tracked is surfaced as "cost data incomplete"/
// "Data unavailable" rather than a made-up number.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from "express";
import type { Request, Response } from "express";
import { ownerAuthMiddleware } from "./auth";
import { requirePermission, asyncHandler } from "./routes/shared";
import { queryOne, queryAll } from "./db-helpers";
import {
  parseDateRange,
  allTimeRange,
  buildOrderWhere,
  salesBreakdown,
  sendCsv,
  toCsv,
  type OrderFilter,
} from "./reporting";

const router = Router();
const VIEW = requirePermission("reports:view");
const EXPORT = requirePermission("reports:export");

const r2 = (n: number, d = 2) => Number(n.toFixed(d));
const money = (n: any) => r2(Number(n || 0));

function filterFromQuery(req: Request): OrderFilter {
  const from = String(req.query.from || allTimeRange().from);
  const to = String(req.query.to || allTimeRange().to);
  const range = parseDateRange(from, to) ?? allTimeRange();
  const groupRaw = req.query.group_id ? String(req.query.group_id) : undefined;
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
  return {
    from: range.from,
    to: range.to,
    groupId: groupRaw && groupRaw !== "all" ? groupRaw : undefined,
    branchId,
    staffId: req.query.staff_id ? Number(req.query.staff_id) : undefined,
    paymentMethod: req.query.payment_method ? String(req.query.payment_method) : undefined,
    productId: req.query.product_id ? String(req.query.product_id) : undefined,
  };
}

// ─── Gross profit ───────────────────────────────────────────────────────────

type ProfitDim = "all" | "product" | "category" | "group";

const PROFIT_LINE = `FROM orders o
  JOIN order_items oi ON oi.order_id = o.id AND NOT oi.cancelled
  LEFT JOIN products pp ON pp.id = oi.product_id`;

async function profitRows(filter: OrderFilter, dim: ProfitDim = "all"): Promise<any[]> {
  const { where, params } = buildOrderWhere(filter);
  const dimSql: Record<ProfitDim, { select: string; group: string; join: string }> = {
    all: { select: "NULL AS id, 'All' AS label", group: "", join: "" },
    product: { select: "oi.product_id AS id, oi.name AS label", group: "oi.product_id, oi.name", join: "" },
    category: { select: "COALESCE(NULLIF(pp.category,''),'Uncategorised') AS id, COALESCE(NULLIF(pp.category,''),'Uncategorised') AS label", group: "pp.category", join: "" },
    group: { select: "COALESCE(NULLIF(pg.name,''),'Ungrouped') AS id, COALESCE(NULLIF(pg.name,''),'Ungrouped') AS label", group: "pg.name", join: " LEFT JOIN product_groups pg ON pg.id = pp.group_id" },
  };
  const d = dimSql[dim];
  return await queryAll(
    `SELECT ${d.select},
       COUNT(*)::int AS lines,
       COUNT(*) FILTER (WHERE oi.unit_cost IS NOT NULL)::int AS costed_lines,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
       COALESCE(SUM(oi.quantity * oi.unit_cost), 0) AS cost,
       COALESCE(SUM(oi.quantity), 0) AS units
     ${PROFIT_LINE}${d.join}
     WHERE ${where}${d.group ? ` GROUP BY ${d.group}` : ""} ORDER BY revenue DESC`,
    params
  );
}

router.get("/gross-profit", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const by = String(req.query.by || "all");
  const dim: ProfitDim = by === "product" || by === "category" || by === "group" ? by : "all";
  const rows = (await profitRows(filter, dim)).map((r: any) => {
    const revenue = money(r.revenue);
    const cost = money(r.cost);
    const costedRevenue = Number(r.costed_lines || 0) > 0 ? revenue : 0;
    return {
      id: r.id,
      label: String(r.label === null ? "—" : r.label),
      revenue,
      cost,
      profit: money(revenue - cost),
      margin_pct: costedRevenue !== 0 ? r2(((revenue - cost) / costedRevenue) * 100) : null,
      cost_coverage_pct: Number(r.lines) > 0 ? r2((Number(r.costed_lines) / Number(r.lines)) * 100) : null,
      lines_with_cost: Number(r.costed_lines || 0),
      lines_without_cost: Number(r.lines || 0) - Number(r.costed_lines || 0),
      units: Number(r.units || 0),
    };
  });
  const costedRevenue = rows.reduce((s, r) => s + (r.cost_coverage_pct !== null ? r.revenue : 0), 0);
  const totals = {
    revenue: money(rows.reduce((s, r) => s + r.revenue, 0)),
    cost: money(rows.reduce((s, r) => s + r.cost, 0)),
    profit: money(rows.reduce((s, r) => s + r.profit, 0)),
    costed_revenue: money(costedRevenue),
    margin_pct: costedRevenue !== 0 ? r2((rows.reduce((s, r) => s + r.profit, 0) / costedRevenue) * 100) : null,
    lines: rows.reduce((s, r) => s + r.lines_with_cost + r.lines_without_cost, 0),
    lines_with_cost: rows.reduce((s, r) => s + r.lines_with_cost, 0),
    lines_without_cost: rows.reduce((s, r) => s + r.lines_without_cost, 0),
  };
  res.json({ by: dim, from: filter.from, to: filter.to, totals, rows });
}));

router.get("/gross-profit/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const by = String(req.query.by || "product");
  const dim: ProfitDim = by === "category" || by === "group" ? by : "product";
  const rows = await profitRows(filter, dim);
  const csv = toCsv(
    rows.map((r: any) => {
      const revenue = money(r.revenue);
      const cost = money(r.cost);
      const profit = money(revenue - cost);
      return {
        item: String(r.label ?? r.id ?? "—"),
        units: Number(r.units || 0),
        revenue,
        cost,
        profit,
        margin_pct: Number(r.costed_lines) > 0 ? r2((profit / revenue) * 100) : "",
        cost_coverage_pct: Number(r.lines) > 0 ? r2((Number(r.costed_lines) / Number(r.lines)) * 100) : "",
      };
    }),
    [
      { key: "item", label: "Item" },
      { key: "units", label: "Units" },
      { key: "revenue", label: "Revenue" },
      { key: "cost", label: "COGS" },
      { key: "profit", label: "Gross profit" },
      { key: "margin_pct", label: "Margin %" },
      { key: "cost_coverage_pct", label: "Cost coverage %" },
    ]
  );
  sendCsv(res, `gross-profit-${dim}-${filter.from}-to-${filter.to}.csv`, csv);
}));

// ─── Payments & collections ─────────────────────────────────────────────────

router.get("/payments", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const { where, params } = buildOrderWhere(filter);
  const rows = await queryAll(
    `SELECT COALESCE(NULLIF(o.payment_method,''),'unrecorded') AS method,
       COUNT(*)::int AS orders,
       COUNT(*) FILTER (WHERE o.status IN ('paid','shipped','delivered'))::int AS collected_orders,
       COALESCE(SUM(li.line_revenue), 0) + COALESCE(SUM(o.shipping_fee), 0) AS revenue,
       COALESCE(SUM(o.amount_refunded), 0) AS refunds
     FROM orders o LEFT JOIN (
        SELECT oi2.order_id, SUM(oi2.price * oi2.quantity) AS line_revenue
        FROM order_items oi2 WHERE NOT oi2.cancelled GROUP BY oi2.order_id
     ) li ON li.order_id = o.id
     WHERE ${where}
     GROUP BY o.payment_method ORDER BY revenue DESC`,
    params
  );
  const methods = rows.map((r: any) => ({
    method: r.method,
    orders: Number(r.orders || 0),
    collected_orders: Number(r.collected_orders || 0),
    revenue: money(r.revenue),
    refunds: money(r.refunds),
    collected_revenue: money(
      Number(r.collected_orders || 0) > 0 ? Number(r.revenue || 0) : 0
    ),
  }));
  const summary = {
    total_revenue: money(methods.reduce((s, m) => s + m.revenue, 0)),
    total_refunds: money(methods.reduce((s, m) => s + m.refunds, 0)),
    collected_revenue: money(methods.reduce((s, m) => s + (Number(m.collected_orders) > 0 ? m.revenue : 0), 0)),
    outstanding_revenue: money(methods.reduce((s, m) => s + (Number(m.collected_orders) > 0 ? 0 : m.revenue), 0)),
    orders: methods.reduce((s, m) => s + m.orders, 0),
  };
  res.json({ from: filter.from, to: filter.to, summary, methods });
}));

router.get("/payments/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const { where, params } = buildOrderWhere(filter);
  const rows = await queryAll(
    `SELECT COALESCE(NULLIF(o.payment_method,''),'unrecorded') AS method, COUNT(*)::int AS orders, COALESCE(SUM(li.line_revenue),0) + COALESCE(SUM(o.shipping_fee),0) AS revenue, COALESCE(SUM(o.amount_refunded),0) AS refunds
     FROM orders o LEFT JOIN (SELECT oi2.order_id, SUM(oi2.price*oi2.quantity) AS line_revenue FROM order_items oi2 WHERE NOT oi2.cancelled GROUP BY oi2.order_id) li ON li.order_id = o.id
     WHERE ${where} GROUP BY o.payment_method ORDER BY revenue DESC`,
    params
  );
  const csv = toCsv(
    rows.map((r: any) => ({ method: r.method, orders: Number(r.orders || 0), revenue: money(r.revenue), refunds: money(r.refunds) })),
    [{ key: "method", label: "Payment method" }, { key: "orders", label: "Orders" }, { key: "revenue", label: "Revenue" }, { key: "refunds", label: "Refunds" }]
  );
  sendCsv(res, `payments-${filter.from}-to-${filter.to}.csv`, csv);
}));

// ─── Receivables / outstanding order pipeline ───────────────────────────────

const OUTSTANDING_STATUSES = "'pending', 'processing'";

router.get("/receivables", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const { where, params } = buildOrderWhere(filter);
  const sqlWhere = `${where} AND o.status IN (${OUTSTANDING_STATUSES})`;
  const rows = await queryAll(
    `SELECT o.id, o.invoice_number, o.customer_name, o.status, o.created_at,
       (COALESCE(li.line_revenue, 0) + COALESCE(o.shipping_fee, 0)) AS total,
       COALESCE(o.amount_refunded, 0) AS refunded
     FROM orders o LEFT JOIN (
        SELECT oi2.order_id, SUM(oi2.price * oi2.quantity) AS line_revenue
        FROM order_items oi2 WHERE NOT oi2.cancelled GROUP BY oi2.order_id
     ) li ON li.order_id = o.id
     WHERE ${sqlWhere} ORDER BY o.created_at`,
    params
  );
  const aged = (box: string) => (v: number) =>
    box === "0_7" ? v < 7 : box === "7_14" ? v >= 7 && v < 14 : box === "14_30" ? v >= 14 && v < 30 : v >= 30;
  const ageDays = (created: string) => Math.max(0, Math.floor((Date.now() - Date.parse(created)) / (24 * 60 * 60 * 1000)));
  const outline: any[] = [];
  let outstanding = 0;
  const buckets = { "0_7": 0, "7_14": 0, "14_30": 0, "30_plus": 0 } as Record<string, number>;
  for (const r of rows || []) {
    const total = money(r.total);
    outstanding += total;
    const days = ageDays(r.created_at || "");
    Object.keys(buckets).forEach((b) => { if (aged(b)(days)) buckets[b] = money(buckets[b] + total); });
    outline.push({ id: r.id, invoice: r.invoice_number || null, customer: r.customer_name || null, status: r.status, created_at: r.created_at, total, refunded: money(r.refunded), age_days: days });
  }
  res.json({
    from: filter.from,
    to: filter.to,
    summary: { outstanding: money(outstanding), count: outline.length, buckets },
    caption: "Outstanding orders = non-cancelled orders not yet paid or delivered. Money still to flow; not yet accounting income.",
    items: outline.slice(0, 500),
  });
}));

router.get("/receivables/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const { where, params } = buildOrderWhere(filter);
  const rows = await queryAll(
    `SELECT o.id, o.customer_name, o.status, o.created_at, (COALESCE(li.line_revenue,0) + COALESCE(o.shipping_fee,0)) AS total, COALESCE(o.amount_refunded,0) AS refunded
     FROM orders o LEFT JOIN (SELECT oi2.order_id, SUM(oi2.price*oi2.quantity) AS line_revenue FROM order_items oi2 WHERE NOT oi2.cancelled GROUP BY oi2.order_id) li ON li.order_id = o.id
     WHERE ${where} AND o.status IN (${OUTSTANDING_STATUSES}) ORDER BY o.created_at`,
    params
  );
  const csv = toCsv(
    rows.map((r: any) => ({ id: r.id, customer: r.customer_name || "", status: r.status, created_at: r.created_at, total: money(r.total), refunded: money(r.refunded) })),
    [{ key: "id", label: "Order ID" }, { key: "customer", label: "Customer" }, { key: "status", label: "Status" }, { key: "created_at", label: "Created" }, { key: "total", label: "Total" }, { key: "refunded", label: "Refunded" }]
  );
  sendCsv(res, `receivables-${filter.from}-to-${filter.to}.csv`, csv);
}));

// ─── Repairs ────────────────────────────────────────────────────────────────

const COLLECTED = "'collected'"; // completed_at is only stamped when the customer has collected the unit

router.get("/repairs", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const from = String(req.query.from || allTimeRange().from);
  const to = String(req.query.to || allTimeRange().to);
  const range = parseDateRange(from, to) ?? allTimeRange();
  const byStatus = await queryAll(
    `SELECT status, COUNT(*)::int AS tickets,
       COALESCE(SUM(total_cost), 0) AS revenue
     FROM repair_tickets
     WHERE created_at::timestamp >= $1 AND created_at::timestamp < ($2::date + interval '1 day')
     GROUP BY status ORDER BY tickets DESC`,
    [range.from, range.to]
  );
  const statuses = (byStatus || []).map((r: any) => ({ status: r.status, tickets: Number(r.tickets || 0), revenue: money(r.revenue) }));
  const summaryRow = await queryOne(
    `SELECT COUNT(*)::int AS tickets,
       COUNT(*) FILTER (WHERE status = 'collected')::int AS completed,
       COUNT(*) FILTER (WHERE status IN ('cancelled','rejected'))::int AS cancelled,
       COALESCE(SUM(total_cost) FILTER (WHERE status = 'collected'), 0) AS revenue,
       COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at::timestamp - created_at::timestamp)) / 86400.0) FILTER (WHERE status = 'collected' AND completed_at IS NOT NULL), 0) AS avg_turnover_days,
       COUNT(*) FILTER (WHERE status = 'collected' AND completed_at IS NOT NULL)::int AS with_turnover
     FROM repair_tickets
     WHERE created_at::timestamp >= $1 AND created_at::timestamp < ($2::date + interval '1 day')`,
    [range.from, range.to]
  ) as any;
  res.json({
    from: range.from,
    to: range.to,
    summary: {
      tickets: Number(summaryRow?.tickets || 0),
      completed: Number(summaryRow?.completed || 0),
      cancelled: Number(summaryRow?.cancelled || 0),
      revenue: money(summaryRow?.revenue),
      avg_turnover_days: summaryRow && Number(summaryRow.with_turnover) > 0 ? r2(Number(summaryRow.avg_turnover_days || 0)) : null,
    },
    statuses,
    note: "Completed counts only tickets with status 'collected' (completed_at is stamped on collection). Other statuses await completion.",
  });
}));

router.get("/repairs/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const from = String(req.query.from || allTimeRange().from);
  const to = String(req.query.to || allTimeRange().to);
  const range = parseDateRange(from, to) ?? allTimeRange();
  const rows = await queryAll(
    `SELECT status, COUNT(*)::int AS tickets, COALESCE(SUM(total_cost), 0) AS revenue
     FROM repair_tickets
     WHERE created_at::timestamp >= $1 AND created_at::timestamp < ($2::date + interval '1 day')
     GROUP BY status ORDER BY tickets DESC`,
    [range.from, range.to]
  );
  const csv = toCsv(
    (rows || []).map((r: any) => ({ status: r.status, tickets: Number(r.tickets || 0), revenue: money(r.revenue) })),
    [{ key: "status", label: "Status" }, { key: "tickets", label: "Tickets" }, { key: "revenue", label: "Revenue" }]
  );
  sendCsv(res, `repairs-${range.from}-to-${range.to}.csv`, csv);
}));

// ─── Warranty ───────────────────────────────────────────────────────────────

router.get("/warranty", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const from = String(req.query.from || allTimeRange().from);
  const to = String(req.query.to || allTimeRange().to);
  const range = parseDateRange(from, to) ?? allTimeRange();
  const [claims, sold, expiring, byStatus] = await Promise.all([
    queryAll(`SELECT * FROM warranty_claims WHERE claim_date::timestamp >= $1 AND claim_date::timestamp < ($2::date + interval '1 day') ORDER BY claim_date DESC LIMIT 500`, [range.from, range.to]),
    queryOne(`SELECT COUNT(*)::int AS units_sold, COUNT(*) FILTER (WHERE warranty_expires IS NOT NULL)::int AS coverage
              FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
              WHERE o.created_at::timestamp >= $1 AND o.created_at::timestamp < ($2::date + interval '1 day') AND NOT oi.cancelled AND oi.has_warranty >= 1`, [range.from, range.to]),
    queryAll(`SELECT oi.id, oi.name, oi.serial_number, oi.warranty_expires, oi.order_id FROM order_items oi
              WHERE NOT oi.cancelled AND oi.has_warranty >= 1 AND oi.warranty_expires IS NOT NULL
                AND oi.warranty_expires::date >= $1 AND oi.warranty_expires::date < ($2::date + interval '1 day') ORDER BY oi.warranty_expires LIMIT 200`, [new Date().toISOString().slice(0, 10), new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)]),
    queryAll(`SELECT status, COUNT(*)::int AS cnt FROM warranty_claims GROUP BY status ORDER BY cnt DESC`),
  ]);
  const unitsSold = Number((sold as any)?.units_sold || 0);
  const claimRate = unitsSold > 0 ? r2((claims?.length ?? 0) / unitsSold * 100) : null;
  res.json({
    from: range.from,
    to: range.to,
    summary: {
      claims: claims?.length ?? 0,
      units_sold_with_warranty: unitsSold,
      coverage_active: Number((sold as any)?.coverage || 0),
      claim_rate_pct: claimRate,
      expiring_next_30_days: expiring?.length ?? 0,
    },
    statuses: byStatus || [],
    note: "Claim rate = claims ÷ units sold with warranty in the period; blank when no warranty sales are recorded.",
  });
}));

router.get("/warranty/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const from = String(req.query.from || allTimeRange().from);
  const to = String(req.query.to || allTimeRange().to);
  const range = parseDateRange(from, to) ?? allTimeRange();
  const claims = await queryAll(`SELECT warranty_ref, status, claim_date, resolution_date, serial_number FROM warranty_claims WHERE claim_date::timestamp >= $1 AND claim_date::timestamp < ($2::date + interval '1 day') ORDER BY claim_date DESC`, [range.from, range.to]);
  const csv = toCsv(
    (claims || []).map((c: any) => ({ ref: c.warranty_ref, status: c.status, serial: c.serial_number || "", claim_date: c.claim_date, resolution_date: c.resolution_date || "" })),
    [{ key: "ref", label: "Reference" }, { key: "status", label: "Status" }, { key: "serial", label: "Serial" }, { key: "claim_date", label: "Claim date" }, { key: "resolution_date", label: "Resolution date" }]
  );
  sendCsv(res, `warranty-claims-${range.from}-to-${range.to}.csv`, csv);
}));

// ─── Customers ──────────────────────────────────────────────────────────────

router.get("/customers", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const top = await salesBreakdown(filter, "customer");
  const row = await queryOne(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE created_at::timestamp >= $1 AND created_at::timestamp < ($2::date + interval '1 day'))::int AS new_in_period,
       COUNT(*) FILTER (WHERE is_active = 1)::int AS active_accounts
     FROM customers`,
    [filter.from, filter.to]
  ) as any;
  const buyer = await queryOne(
    `SELECT COUNT(DISTINCT customer_id)::int AS buyers,
       COUNT(*) FILTER (WHERE buyer_orders = 1)::int AS repeat_buyers
     FROM (SELECT customer_id, COUNT(*)::int AS buyer_orders FROM orders
           WHERE customer_id IS NOT NULL AND status != 'cancelled'
             AND created_at::timestamp >= $1 AND created_at::timestamp < ($2::date + interval '1 day')
           GROUP BY customer_id) t`,
    [filter.from, filter.to]
  ) as any;
  const totalCustomers = Number(row?.total || 0);
  const buyers = Number(buyer?.buyers || 0);
  res.json({
    from: filter.from,
    to: filter.to,
    summary: {
      total_customers: totalCustomers,
      new_in_period: Number(row?.new_in_period || 0),
      active_accounts: Number(row?.active_accounts || 0),
      buyers_in_period: buyers,
      repeat_buyers: Number(buyer?.repeat_buyers || 0),
      repeat_rate_pct: buyers > 0 ? r2((Number(buyer?.repeat_buyers || 0) / buyers) * 100) : null,
      average_spend_per_customer: buyers > 0 ? r2(top.reduce((s, t) => s + t.revenue, 0) / buyers) : null,
    },
    top_customers: top.slice(0, 25).map((t) => ({ name: t.label, orders: t.orders, revenue: r2(t.revenue), net: r2(t.net) })),
  });
}));

router.get("/customers/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const filter = filterFromQuery(req);
  const top = await salesBreakdown(filter, "customer");
  const csv = toCsv(
    top.slice(0, 500).map((t) => ({ name: t.label, orders: t.orders, gross: r2(t.revenue), net: r2(t.net) })),
    [{ key: "name", label: "Customer" }, { key: "orders", label: "Orders" }, { key: "gross", label: "Gross sales" }, { key: "net", label: "Net sales" }]
  );
  sendCsv(res, `customers-${filter.from}-to-${filter.to}.csv`, csv);
}));

// ─── Stock valuation ────────────────────────────────────────────────────────

router.get("/valuation", ownerAuthMiddleware, VIEW, asyncHandler(async (req: Request, res: Response) => {
  const by = String(req.query.by || "category");
  const dim =
    by === "group"
      ? { expr: "COALESCE(NULLIF(pg.name,''),'Ungrouped')", join: " LEFT JOIN product_groups pg ON pg.id = p.group_id" }
      : by === "product"
      ? { expr: "p.id", join: "" }
      : { expr: "COALESCE(NULLIF(p.category,''),'Uncategorised')", join: "" };
  const rows = await queryAll(
    `SELECT ${dim.expr} AS dim,
       COUNT(*)::int AS products,
       COUNT(*) FILTER (WHERE p.cost_price IS NOT NULL)::int AS costed_products,
       COALESCE(SUM(p.stock_on_hand), 0)::int AS units,
       COALESCE(SUM(p.stock_on_hand * p.price), 0) AS retail_value,
       COALESCE(SUM(p.stock_on_hand * p.cost_price), 0) AS cost_value
     FROM products p${dim.join}
     WHERE p.is_hidden = 0
     GROUP BY ${dim.expr} ORDER BY retail_value DESC`,
    []
  );
  const lines = (rows || []).map((r: any) => ({
    id: r.dim,
    label: String(r.dim === null || r.dim === "" ? "—" : r.dim),
    products: Number(r.products || 0),
    costed_products: Number(r.costed_products || 0),
    units: Number(r.units || 0),
    retail_value: money(r.retail_value),
    cost_value: money(r.cost_value),
    cost_coverage_pct: Number(r.products) > 0 ? r2((Number(r.costed_products) / Number(r.products)) * 100) : null,
  }));
  const totals = {
    products: lines.reduce((s, l) => s + l.products, 0),
    costed_products: lines.reduce((s, l) => s + l.costed_products, 0),
    units: lines.reduce((s, l) => s + l.units, 0),
    retail_value: money(lines.reduce((s, l) => s + l.retail_value, 0)),
    cost_value: money(lines.reduce((s, l) => s + l.cost_value, 0)),
    margin_on_hand: money(lines.reduce((s, l) => s + (l.retail_value - l.cost_value), 0)),
  };
  res.json({ by: by === "product" ? "product" : by === "group" ? "group" : "category", totals, rows: lines });
}));

router.get("/valuation/export.csv", ownerAuthMiddleware, EXPORT, asyncHandler(async (req: Request, res: Response) => {
  const rows = await queryAll(
    `SELECT COALESCE(NULLIF(p.category,''),'Uncategorised') AS dim, p.id, p.name, p.stock_on_hand, p.price, p.cost_price
     FROM products p WHERE p.is_hidden = 0 ORDER BY dim, p.name`,
    []
  );
  const csv = toCsv(
    (rows || []).map((r: any) => ({
      category: r.dim, id: r.id, name: r.name, units: Number(r.stock_on_hand || 0),
      unit_price: money(r.price), unit_cost: r.cost_price === null ? "cost data incomplete" : money(r.cost_price),
      retail_value: money(Number(r.stock_on_hand || 0) * Number(r.price || 0)),
      cost_value: r.cost_price === null ? "" : money(Number(r.stock_on_hand || 0) * Number(r.cost_price)),
    })),
    [{ key: "category", label: "Category" }, { key: "id", label: "Product ID" }, { key: "name", label: "Product" }, { key: "units", label: "On hand" }, { key: "unit_price", label: "Unit price" }, { key: "unit_cost", label: "Unit cost" }, { key: "retail_value", label: "Retail value" }, { key: "cost_value", label: "Cost value" }]
  );
  sendCsv(res, `stock-valuation.csv`, csv);
}));

// ─── Stock take summary ─────────────────────────────────────────────────────

router.get("/stock-take-summary", ownerAuthMiddleware, VIEW, asyncHandler(async (_req: Request, res: Response) => {
  const rows = await queryAll(
    `SELECT s.id, s.status, s.created_at, s.completed_at,
       COUNT(sti.id)::int AS items,
       COALESCE(SUM(sti.variance), 0)::int AS net_variance_units,
       COALESCE(SUM(ABS(sti.variance)), 0)::int AS gross_variance_units,
       COALESCE(SUM(sti.variance * pp.price), 0) AS variance_retail,
       COALESCE(SUM(sti.variance * pp.cost_price), 0) AS variance_cost
     FROM stock_take_sessions s
     LEFT JOIN stock_take_items sti ON sti.session_id = s.id
     LEFT JOIN products pp ON pp.id = sti.product_id
     GROUP BY s.id ORDER BY s.created_at DESC LIMIT 50`,
    []
  );
  res.json({ sessions: (rows || []).map((r: any) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    completed_at: r.completed_at || null,
    items: Number(r.items || 0),
    net_variance_units: Number(r.net_variance_units || 0),
    gross_variance_units: Number(r.gross_variance_units || 0),
    variance_retail: money(r.variance_retail),
    variance_cost: r.variance_cost === null ? null : money(r.variance_cost),
  })) });
}));

export default router;