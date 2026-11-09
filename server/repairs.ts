import { query, queryOne, queryAll, transaction } from "./db-helpers";
import { getStoreSetting } from "./db";
import { createHash } from "node:crypto";

interface RepairType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
}

interface TicketRow {
  id: string;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  serial_number: string;
  order_item_id: number | null;
  service_kind: string;
  issue_summary: string;
  issue_description: string;
  requested_visit_date: string;
  requested_visit_time: string;
  status: string;
  priority: string;
  assigned_to: number | null;
  assigned_name?: string | null;
  eta_at: string;
  scheduled_at: string | null;
  scheduled_duration_minutes: number;
  diagnosis: string;
  diagnosis_due_at: string | null;
  diagnosis_recorded_at: string | null;
  diagnosis_last_reminded_at: string | null;
  hold_reason: string;
  hold_remind_at: string | null;
  hold_last_reminded_at: string | null;
  work_notes: string;
  customer_notes: string;
  repair_type: string | null;
  hardware_value: number;
  labor_cost: number;
  parts_cost: number;
  software_install: number;
  software_license: number;
  software_license_product_id: string | null;
  software_license_price: number;
  software_license_product_name?: string | null;
  total_cost: number;
  quote_sent_at: string | null;
  quote_responded_at: string | null;
  quote_response: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface Part {
  id: number;
  description: string;
  productId: string | null;
  quantity: number;
  unitCost: number;
  createdAt: string;
}

interface RepairUpdate {
  id: number;
  message: string;
  updateType: string;
  staffName: string;
  createdAt: string;
  customerVisible: boolean;
}

interface Ticket {
  id: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
  orderItemId: number | null;
  serviceKind: "diagnosis_repair" | "planned_service";
  issueSummary: string;
  issueDescription: string;
  requestedVisitDate: string;
  requestedVisitTime: string;
  status: string;
  statusLabel: string;
  priority: string;
  assignedTo: number | null;
  assignedName: string | null;
  etaAt: string;
  scheduledAt: string | null;
  scheduledDurationMinutes: number;
  diagnosis: string;
  diagnosisDueAt: string | null;
  diagnosisRecordedAt: string | null;
  diagnosisLastRemindedAt: string | null;
  holdReason: string;
  holdRemindAt: string | null;
  holdLastRemindedAt: string | null;
  workNotes: string;
  customerNotes: string;
  repairType: string | null;
  repairTypeName: string;
  hardwareValue: number;
  laborCost: number;
  partsCost: number;
  softwareInstall: boolean;
  softwareLicense: boolean;
  softwareLicenseProductId: string | null;
  softwareLicenseProductName: string;
  softwareLicensePrice: number;
  totalCost: number;
  quoteSentAt: string | null;
  quoteVersion: number | null;
  quoteExpiresAt: string | null;
  quoteDeliveryStatus: string | null;
  quoteRespondedAt: string | null;
  quoteResponse: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  parts: Part[];
  updates: RepairUpdate[];
}

export function customerSafeRepairTicket(ticket: Ticket): any {
  const customerTicket: any = { ...ticket };
  for (const key of ["workNotes", "priority", "diagnosisDueAt", "diagnosisRecordedAt", "diagnosisLastRemindedAt", "holdReason", "holdRemindAt", "holdLastRemindedAt"]) delete customerTicket[key];
  return customerTicket;
}

interface TicketResult {
  ok: boolean;
  error?: string;
  ticket?: Ticket;
  part?: Part;
}

interface PagedResult {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

interface StaffFilter {
  status?: string;
  assignedTo?: number;
  customerId?: number;
}

interface CustomerPagedFilter {
  status?: string;
  page?: number;
  pageSize?: number;
}

interface DashboardStats {
  openRepairs: number;
  dueToday: number;
  scheduledToday: number;
  unassigned: number;
}

interface TicketUpdates {
  status?: string;
  priority?: string;
  assignedTo?: number | null;
  etaAt?: string | null;
  scheduledAt?: string | null;
  scheduledDurationMinutes?: number;
  diagnosis?: string;
  holdReason?: string;
  holdRemindAt?: string | null;
  workNotes?: string;
  customerNotes?: string;
  deviceType?: string;
  deviceModel?: string;
  issueDescription?: string;
  repairType?: string | null;
  hardwareValue?: number;
  softwareInstall?: boolean;
  softwareLicense?: boolean;
  softwareLicenseProductId?: string | null;
}

const STATUSES: string[] = [
  "received", "diagnosing", "waiting_parts", "awaiting_approval", "approved",
  "in_progress", "quality_check", "ready", "unrepairable", "collected", "cancelled", "rejected", "on_hold",
];

const STATUS_LABELS: { [key: string]: string } = {
  received: "Received",
  diagnosing: "Diagnosing",
  waiting_parts: "Waiting for parts",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  in_progress: "In progress",
  quality_check: "Quality check",
  ready: "Ready for collection",
  unrepairable: "Unrepairable",
  collected: "Collected",
  cancelled: "Cancelled",
  rejected: "Rejected",
  on_hold: "On hold",
};

const PRIORITIES = ["low", "normal", "high", "critical"] as const;

function isValidStatus(status: string): boolean {
  return STATUSES.includes(status);
}

// Enforced repair lifecycle: a ticket may only move through these transitions,
// so statuses like received->collected or bypassing diagnostic/approval/QC are
// rejected server-side. A ticket may always stay on its current status (idempotent
// saves), and 'cancelled'/'collected' are terminal once reached.
const VALID_TRANSITIONS: { [from: string]: string[] } = {
  received: ["received", "diagnosing", "awaiting_approval", "on_hold", "cancelled"],
  diagnosing: ["diagnosing", "waiting_parts", "awaiting_approval", "in_progress", "quality_check", "ready", "rejected", "unrepairable", "on_hold", "cancelled"],
  waiting_parts: ["waiting_parts", "diagnosing", "awaiting_approval", "approved", "in_progress", "on_hold", "cancelled"],
  awaiting_approval: ["awaiting_approval", "approved", "rejected", "diagnosing", "in_progress", "waiting_parts", "on_hold", "cancelled"],
  approved: ["approved", "in_progress", "waiting_parts", "diagnosing", "quality_check", "ready", "unrepairable", "on_hold", "cancelled"],
  in_progress: ["in_progress", "quality_check", "waiting_parts", "awaiting_approval", "approved", "ready", "on_hold", "cancelled"],
  quality_check: ["quality_check", "in_progress", "ready", "unrepairable", "on_hold", "cancelled"],
  ready: ["ready", "quality_check", "collected", "unrepairable", "on_hold", "cancelled"],
  unrepairable: ["unrepairable", "collected", "on_hold", "cancelled"],
  collected: ["collected"],
  cancelled: ["cancelled"],
  rejected: ["rejected", "collected", "diagnosing", "cancelled"],
  on_hold: ["on_hold", "received", "diagnosing", "waiting_parts", "awaiting_approval", "approved", "in_progress", "quality_check", "ready", "unrepairable", "cancelled"],
};

function isValidTransition(from: string | undefined, to: string): boolean {
  if (!from) return true;
  const allowed = VALID_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

async function generateTicketId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REP-${year}-`;
  const row = await queryOne(
    "SELECT id FROM repair_tickets WHERE id LIKE $1 ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  ) as { id: string } | undefined;
  let seq = 1;
  if (row) {
    const part = row.id.split("-").pop();
    seq = Number(part) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function mapPart(row: any): Part {
  return {
    id: row.id,
    description: row.description,
    productId: row.product_id || null,
    quantity: row.quantity,
    unitCost: row.unit_cost,
    createdAt: row.created_at,
  };
}

function mapUpdate(row: any, staffName?: string): RepairUpdate {
  return {
    id: row.id,
    message: row.message,
    updateType: row.update_type,
    staffName: staffName || "Staff",
    createdAt: row.created_at,
    customerVisible: Boolean(row.customer_visible),
  };
}

async function getRepairTypeName(typeId: string | null): Promise<string> {
  if (!typeId) return "";
  const row = await queryOne("SELECT name FROM repair_types WHERE id = $1", [typeId]) as { name: string } | undefined;
  return row?.name || "";
}

async function calculateRepairCost(typeId: string | null, hardwareValue: number, partsCost: number, softwareInstall: boolean, softwareLicensePrice: number): Promise<number> {
  let total = 0;
  if (typeId) {
    const rt = await queryOne("SELECT base_price FROM repair_types WHERE id = $1", [typeId]) as { base_price?: number } | undefined;
    if (rt?.base_price) total += rt.base_price;
    if (hardwareValue > 0) {
      total += Math.round(hardwareValue * 0.05);
    }
  }
  total += partsCost;
  // Software installation remains a store-configurable service fee. License
  // prices are supplied separately from a catalog product snapshot.
  const installFee = Number(await getStoreSetting("repair_software_install_fee")) || 800;
  if (softwareInstall && softwareLicensePrice <= 0) total += installFee;
  total += Math.max(0, Number(softwareLicensePrice) || 0);
  return total;
}

async function mapTicket(row: TicketRow, extras: any = {}): Promise<Ticket> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: extras.customerName || row.customer_name || "",
    customerEmail: extras.customerEmail || row.customer_email || "",
    deviceType: row.device_type,
    deviceBrand: row.device_brand || "",
    deviceModel: row.device_model || "",
    serialNumber: row.serial_number || "",
    orderItemId: row.order_item_id == null ? null : Number(row.order_item_id),
    serviceKind: row.service_kind === "planned_service" ? "planned_service" : "diagnosis_repair",
    issueSummary: row.issue_summary || "",
    issueDescription: row.issue_description,
    requestedVisitDate: row.requested_visit_date || "",
    requestedVisitTime: row.requested_visit_time || "",
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    priority: row.priority || "normal",
    assignedTo: row.assigned_to,
    assignedName: extras.assignedName || row.assigned_name || null,
    etaAt: row.eta_at,
    scheduledAt: row.scheduled_at,
    scheduledDurationMinutes: Number(row.scheduled_duration_minutes) || 60,
    diagnosis: row.diagnosis || "",
    diagnosisDueAt: row.diagnosis_due_at || null,
    diagnosisRecordedAt: row.diagnosis_recorded_at || null,
    diagnosisLastRemindedAt: row.diagnosis_last_reminded_at || null,
    holdReason: row.hold_reason || "",
    holdRemindAt: row.hold_remind_at || null,
    holdLastRemindedAt: row.hold_last_reminded_at || null,
    workNotes: row.work_notes || "",
    customerNotes: row.customer_notes || "",
    repairType: row.repair_type || null,
    repairTypeName: await getRepairTypeName(row.repair_type),
    hardwareValue: row.hardware_value || 0,
    laborCost: row.labor_cost || 0,
    partsCost: row.parts_cost || 0,
    softwareInstall: Boolean(row.software_install),
    softwareLicense: Boolean(row.software_license),
    softwareLicenseProductId: row.software_license_product_id || null,
    softwareLicenseProductName: row.software_license_product_name || "",
    softwareLicensePrice: Number(row.software_license_price) || 0,
    totalCost: row.total_cost || 0,
    quoteSentAt: row.quote_sent_at || null,
    quoteVersion: extras.quoteVersion ?? null,
    quoteExpiresAt: extras.quoteExpiresAt ?? null,
    quoteDeliveryStatus: extras.quoteDeliveryStatus ?? null,
    quoteRespondedAt: row.quote_responded_at || null,
    quoteResponse: row.quote_response || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    parts: extras.parts || [],
    updates: extras.updates || [],
  };
}

async function loadTicketDetails(ticketId: string): Promise<Ticket | null> {
  const row = await queryOne(
    `SELECT t.*, c.name AS customer_name, c.email AS customer_email,
            u.username AS assigned_name, lp.name AS software_license_product_name
     FROM repair_tickets t
     JOIN customers c ON c.id = t.customer_id
     LEFT JOIN users u ON u.id = t.assigned_to
     LEFT JOIN products lp ON lp.id = t.software_license_product_id
     WHERE t.id = $1`,
    [ticketId]
  ) as TicketRow | undefined;

  if (!row) return null;

  const partRows = await queryAll("SELECT * FROM repair_parts_used WHERE ticket_id = $1 ORDER BY id", [ticketId]);
  const parts: Part[] = partRows.map((r: any) => mapPart(r));

  const updateRows = await queryAll(
    `SELECT ru.*, u.username AS staff_name
     FROM repair_updates ru
     LEFT JOIN users u ON u.id = ru.staff_id
     WHERE ru.ticket_id = $1
     ORDER BY ru.created_at ASC`,
    [ticketId]
  );
  const updates: RepairUpdate[] = updateRows.map((u: any) => mapUpdate(u, u.staff_name));
  const quote = await queryOne(
    "SELECT version, expires_at, delivery_status FROM repair_quote_versions WHERE ticket_id = $1 ORDER BY version DESC LIMIT 1",
    [ticketId]
  ) as any;

  return mapTicket(row, { parts, updates, quoteVersion: quote ? Number(quote.version) : null, quoteExpiresAt: quote?.expires_at || null, quoteDeliveryStatus: quote?.delivery_status || null });
}

async function createRepairTicket(customerId: number, data: any): Promise<TicketResult> {
  const id = await generateTicketId();
  const deviceType = String(data.deviceType || "").trim();
  const deviceBrand = String(data.deviceBrand || "").trim().slice(0, 100);
  const deviceModel = String(data.deviceModel || "").trim().slice(0, 150);
  const serialNumber = String(data.serialNumber || "").trim().slice(0, 100);
  const requestedVisitDate = String(data.requestedVisitDate || "").trim();
  const requestedVisitTime = String(data.requestedVisitTime || "").trim();
  const issueDescription = String(data.issueDescription || "").trim().slice(0, 5000);
  const issueSummary = String(data.issueSummary || "").trim().slice(0, 200) || issueDescription.slice(0, 200);
  const customerNotes = String(data.notes || "").trim().slice(0, 2000);
  if (data.serviceKind !== undefined && !["diagnosis_repair", "planned_service"].includes(data.serviceKind)) {
    return { ok: false, error: "Choose a valid repair or planned service request type." };
  }
  const serviceKind = data.serviceKind === "planned_service" ? "planned_service" : "diagnosis_repair";
  const orderItemId = data.orderItemId == null || data.orderItemId === "" ? null : Number(data.orderItemId);

  if (!deviceType || !issueDescription) {
    return { ok: false, error: "Device type and request details are required." };
  }
  if (orderItemId !== null && (!Number.isInteger(orderItemId) || orderItemId < 1)) {
    return { ok: false, error: "Select a valid purchased device." };
  }
  const parsedVisitDate = requestedVisitDate ? new Date(`${requestedVisitDate}T00:00:00.000Z`) : null;
  if (requestedVisitDate && (!/^\d{4}-\d{2}-\d{2}$/.test(requestedVisitDate) || Number.isNaN(parsedVisitDate?.getTime()) || parsedVisitDate?.toISOString().slice(0, 10) !== requestedVisitDate)) {
    return { ok: false, error: "Preferred visit date must be a valid date." };
  }
  if (requestedVisitTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedVisitTime)) {
    return { ok: false, error: "Preferred visit time must use 24-hour time." };
  }

  if (orderItemId !== null) {
    const purchasedItem = await queryOne(
      `SELECT oi.id, oi.serial_number, o.id AS order_id
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1 AND o.customer_id = $2 AND oi.cancelled = 0
         AND (o.status IN ('paid', 'shipped', 'delivered') OR o.paid_at IS NOT NULL OR COALESCE(o.mpesa_receipt, '') <> '')`,
      [orderItemId, customerId]
    ) as { id: number; serial_number: string; order_id: number } | undefined;
    if (!purchasedItem) return { ok: false, error: "That item is not part of one of your completed purchases." };
    const enteredSerial = serialNumber.trim();
    if (enteredSerial) {
      const serialRows = await queryAll(
        "SELECT serial_number FROM serial_numbers WHERE order_item_id = $1 AND order_id = $2 AND status = 'sold'",
        [orderItemId, purchasedItem.order_id]
      ) as { serial_number: string }[];
      const knownSerials = [...serialRows.map((row) => row.serial_number), ...String(purchasedItem.serial_number || "").split(",").map((value) => value.trim())].filter(Boolean);
      if (knownSerials.length && !knownSerials.includes(enteredSerial)) return { ok: false, error: "Choose a serial number linked to that purchased item." };
    }
  }

  const repairType = data.repairType ? String(data.repairType).trim() : null;
  if (repairType) {
    const rt = await queryOne("SELECT id FROM repair_types WHERE id = $1", [repairType]);
    if (!rt) return { ok: false, error: "Invalid repair type." };
  }

  const symptoms = Array.isArray(data.symptoms)
    ? data.symptoms.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 30)
    : [];
  const fullDescription = symptoms.length
    ? `${issueDescription}\n\nSymptoms: ${symptoms.join(", ")}`
    : issueDescription;

  // R-7: ETA default is configurable via the `repair_eta_hours` setting (hours),
  // falling back to 48 when unset.
  const etaHours = Math.max(1, Number(await getStoreSetting("repair_eta_hours")) || 48);

  await query(
    `INSERT INTO repair_tickets (id, customer_id, device_type, device_brand, device_model, serial_number, order_item_id, service_kind, issue_summary, issue_description, customer_notes, requested_visit_date, requested_visit_time, repair_type, status, eta_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'received', (NOW() + make_interval(hours => $15))::text, NOW()::text, NOW()::text)`,
    [id, customerId, deviceType, deviceBrand, deviceModel, serialNumber, orderItemId, serviceKind, issueSummary, fullDescription, customerNotes, requestedVisitDate, requestedVisitTime, repairType, etaHours]
  );

  await recalculateTicketCost(id);

  await addRepairUpdate(id, null, "status", `Ticket created. Estimated completion within ${etaHours} hours.`, true);

  const ticket = await loadTicketDetails(id);
  return { ok: true, ticket: ticket! };
}

async function listRepairsForCustomer(customerId: number): Promise<Ticket[]> {
  const rows = await queryAll(
    `SELECT t.*, c.name AS customer_name, c.email AS customer_email,
            u.username AS assigned_name
     FROM repair_tickets t
     JOIN customers c ON c.id = t.customer_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.customer_id = $1
     ORDER BY t.created_at DESC`,
    [customerId]
  ) as TicketRow[];

  const tickets: Ticket[] = [];
  for (const row of rows) {
    const ticket = await mapTicket(row);
    const updateRows = await queryAll(
      `SELECT ru.*, u.username AS staff_name
       FROM repair_updates ru
       LEFT JOIN users u ON u.id = ru.staff_id
       WHERE ru.ticket_id = $1 AND ru.customer_visible = 1
       ORDER BY ru.created_at ASC`,
      [ticket.id]
    );
    ticket.updates = updateRows.map((u: any) => mapUpdate(u, u.staff_name));
    tickets.push(ticket);
  }
  return tickets;
}

async function listCustomerRepairDevices(customerId: number): Promise<any[]> {
  const rows = await queryAll(
    `SELECT oi.id AS order_item_id, oi.name AS item_name, oi.product_id,
            oi.quantity, oi.serial_number AS stored_serial_numbers,
            o.id AS order_id, o.created_at AS purchased_at, p.category,
            COALESCE(array_agg(DISTINCT sn.serial_number) FILTER (WHERE sn.serial_number IS NOT NULL), ARRAY[]::text[]) AS serial_numbers
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN serial_numbers sn ON sn.order_item_id = oi.id AND sn.order_id = o.id AND sn.status = 'sold'
     WHERE o.customer_id = $1 AND oi.cancelled = 0
       AND (o.status IN ('paid', 'shipped', 'delivered') OR o.paid_at IS NOT NULL OR COALESCE(o.mpesa_receipt, '') <> '')
     GROUP BY oi.id, oi.name, oi.product_id, oi.quantity, oi.serial_number, o.id, o.created_at, p.category
     ORDER BY o.created_at DESC, oi.id DESC`,
    [customerId]
  ) as any[];
  return rows.map((row) => ({
    orderItemId: Number(row.order_item_id),
    name: String(row.item_name || "Purchased device"),
    productId: String(row.product_id || ""),
    quantity: Number(row.quantity) || 1,
    category: String(row.category || ""),
    purchasedAt: row.purchased_at,
    orderId: Number(row.order_id),
    serialNumbers: [...new Set([...(row.serial_numbers || []), ...String(row.stored_serial_numbers || "").split(",").map((value: string) => value.trim())].filter(Boolean))],
  }));
}

async function listRepairsForCustomerPaged(customerId: number, options: CustomerPagedFilter = {}): Promise<PagedResult> {
  const { status, page = 1, pageSize = 10 } = options;
  const whereClauses: string[] = ["t.customer_id = $1"];
  const params: any[] = [customerId];
  let idx = 2;
  if (status) {
    whereClauses.push(`t.status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRow = await queryOne(`SELECT COUNT(*) AS cnt FROM repair_tickets t ${where}`, params) as { cnt: number };
  const total = countRow ? Number(countRow.cnt) : 0;

  const offset = (Number(page) - 1) * Number(pageSize);
  params.push(Number(pageSize), offset);

  const rows = await queryAll(
    `SELECT t.*, c.name AS customer_name, c.email AS customer_email,
            u.username AS assigned_name
     FROM repair_tickets t
     JOIN customers c ON c.id = t.customer_id
     LEFT JOIN users u ON u.id = t.assigned_to
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  ) as TicketRow[];

  const tickets: Ticket[] = [];
  for (const row of rows) {
    const ticket = await mapTicket(row);
    const updateRows = await queryAll(
      `SELECT ru.*, u.username AS staff_name
       FROM repair_updates ru
       LEFT JOIN users u ON u.id = ru.staff_id
       WHERE ru.ticket_id = $1 AND ru.customer_visible = 1
       ORDER BY ru.created_at ASC`,
      [ticket.id]
    );
    ticket.updates = updateRows.map((u: any) => mapUpdate(u, u.staff_name));
    tickets.push(ticket);
  }

  return { tickets, total, page: Number(page), pageSize: Number(pageSize) };
}

async function listRepairsForStaff(options: StaffFilter = {}): Promise<Ticket[]> {
  const { status, assignedTo, customerId } = options;
  let sql = `
    SELECT t.*, c.name AS customer_name, c.email AS customer_email,
           u.username AS assigned_name
    FROM repair_tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;

  if (status) {
    sql += ` AND t.status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (assignedTo) {
    sql += ` AND t.assigned_to = $${idx}`;
    params.push(assignedTo);
    idx++;
  }
  if (customerId) {
    sql += ` AND t.customer_id = $${idx}`;
    params.push(customerId);
    idx++;
  }

  sql += " ORDER BY t.created_at DESC";

  const rows = await queryAll(sql, params) as TicketRow[];
  const tickets: Ticket[] = [];
  for (const row of rows) {
    tickets.push(await mapTicket(row));
  }
  return tickets;
}

async function listCalendarRepairs(from: string, to: string, assignedTo?: number): Promise<Ticket[]> {
  let sql = `
    SELECT t.*, c.name AS customer_name, c.email AS customer_email,
           u.username AS assigned_name
    FROM repair_tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.scheduled_at IS NOT NULL
      AND t.scheduled_at >= $1
      AND t.scheduled_at < $2
      AND t.status NOT IN ('collected', 'cancelled')
  `;
  const params: any[] = [from, to];
  let idx = 3;

  if (assignedTo) {
    sql += ` AND t.assigned_to = $${idx}`;
    params.push(assignedTo);
    idx++;
  }

  sql += " ORDER BY t.scheduled_at ASC";

  const rows = await queryAll(sql, params) as TicketRow[];
  const tickets: Ticket[] = [];
  for (const row of rows) {
    tickets.push(await mapTicket(row));
  }
  return tickets;
}

async function updateRepairTicket(ticketId: string, updates: TicketUpdates, staffId?: number): Promise<Ticket | { error: string } | null> {
  const existing = await loadTicketDetails(ticketId);
  if (!existing) return null;
  const licenseChanged = updates.softwareLicense !== undefined || updates.softwareLicenseProductId !== undefined;
  let nextSoftwareLicense = existing.softwareLicense;
  let nextLicenseProductId = existing.softwareLicenseProductId;
  let nextLicensePrice = existing.softwareLicensePrice;

  if (updates.softwareLicenseProductId !== undefined) {
    const requestedProductId = String(updates.softwareLicenseProductId || "").trim();
    if (requestedProductId) {
      if (requestedProductId === existing.softwareLicenseProductId && existing.softwareLicense) {
        // Ordinary ticket edits must keep the accepted quote's catalog-price
        // snapshot. Selecting another product is what intentionally reprices it.
        nextSoftwareLicense = true;
        nextLicenseProductId = existing.softwareLicenseProductId;
        nextLicensePrice = existing.softwareLicensePrice;
      } else {
        const product = await queryOne(
          "SELECT id, name, price, sale_price FROM products WHERE id = $1",
          [requestedProductId]
        ) as any;
        if (!product) return { error: "That software license product is no longer in the catalog. Refresh the ticket and choose another." };
        const catalogPrice = Number(product.sale_price) > 0 ? Number(product.sale_price) : Number(product.price);
        if (!Number.isFinite(catalogPrice) || catalogPrice < 0) return { error: "The selected catalog product has an invalid selling price." };
        nextSoftwareLicense = true;
        nextLicenseProductId = String(product.id);
        nextLicensePrice = Math.round(catalogPrice * 100) / 100;
      }
    } else if (updates.softwareLicense === false) {
      nextSoftwareLicense = false;
      nextLicenseProductId = null;
      nextLicensePrice = 0;
    } else if (existing.softwareLicense && !existing.softwareLicenseProductId) {
      // A pre-catalog license charge is kept at its saved historical amount
      // until staff replace it with a catalog product or remove it.
      nextSoftwareLicense = true;
      nextLicenseProductId = null;
    } else if (existing.softwareLicense) {
      return { error: "Choose a catalog license product or remove the license from this estimate." };
    } else {
      nextSoftwareLicense = false;
      nextLicenseProductId = null;
      nextLicensePrice = 0;
    }
  } else if (updates.softwareLicense === false) {
    nextSoftwareLicense = false;
    nextLicenseProductId = null;
    nextLicensePrice = 0;
  } else if (updates.softwareLicense === true && !existing.softwareLicense) {
    return { error: "Choose the licensed software product from the catalog before adding its price." };
  }
  const nextStatus = updates.status ?? existing.status;
  const nextHoldReason = String(updates.holdReason ?? existing.holdReason ?? "").trim().slice(0, 500);
  const nextHoldRemindAt = updates.holdRemindAt === undefined ? existing.holdRemindAt : updates.holdRemindAt;
  const assignedChanged = updates.assignedTo !== undefined && Number(updates.assignedTo || 0) !== Number(existing.assignedTo || 0);
  const nextSchedule = updates.scheduledAt === undefined ? existing.scheduledAt : updates.scheduledAt;
  const nextDuration = updates.scheduledDurationMinutes === undefined ? existing.scheduledDurationMinutes : Number(updates.scheduledDurationMinutes);
  const nextAssignee = updates.assignedTo === undefined ? existing.assignedTo : (updates.assignedTo || null);
  const nextServiceKind = existing.serviceKind;
  const scheduleChanged =
    (updates.scheduledAt !== undefined && String(updates.scheduledAt || "") !== String(existing.scheduledAt || "")) ||
    assignedChanged ||
    (updates.scheduledDurationMinutes !== undefined && nextDuration !== existing.scheduledDurationMinutes);
  if (!Number.isInteger(nextDuration) || nextDuration < 15 || nextDuration > 480) return { error: "Appointment length must be between 15 minutes and 8 hours." };
  if (nextSchedule && Number.isNaN(new Date(nextSchedule).getTime())) return { error: "Choose a valid appointment date and time." };
  if (updates.priority !== undefined && !PRIORITIES.includes(updates.priority as any)) return { error: "Priority must be low, normal, high, or critical." };
  if (nextStatus === "on_hold") {
    if (!nextHoldReason) return { error: "Add a reason before putting this ticket on hold." };
    const holdDate = nextHoldRemindAt ? new Date(nextHoldRemindAt) : null;
    const reminderChanged = updates.holdRemindAt !== undefined;
    const enteringHold = existing.status !== "on_hold";
    if (!holdDate || Number.isNaN(holdDate.getTime()) || ((enteringHold || reminderChanged) && holdDate.getTime() <= Date.now())) return { error: "Choose a future reminder date before putting this ticket on hold." };
  }

  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (updates.status !== undefined) {
    if (!isValidStatus(updates.status)) return { error: "Invalid status." };
    if (!isValidTransition(existing?.status, updates.status)) return { error: "Invalid status transition." };
    fields.push(`status = $${idx}`);
    params.push(updates.status);
    idx++;
    if (updates.status === "collected") {
      fields.push("completed_at = NOW()::text");
    }
  }
  if (updates.priority !== undefined && updates.priority !== existing.priority) {
    fields.push(`priority = $${idx}`);
    params.push(updates.priority);
    idx++;
  }
  if (updates.assignedTo !== undefined) {
    fields.push(`assigned_to = $${idx}`);
    params.push(updates.assignedTo || null);
    idx++;
    if (assignedChanged && updates.diagnosis === undefined && nextStatus !== "on_hold") {
      if (nextServiceKind === "planned_service") {
        fields.push("diagnosis_due_at = NULL");
      } else if (updates.assignedTo && !String(updates.diagnosis ?? existing.diagnosis).trim()) {
        const slaHours = Math.min(168, Math.max(1, Number(await getStoreSetting("repair_diagnosis_sla_hours")) || 24));
        fields.push(`diagnosis_due_at = (NOW() + make_interval(hours => $${idx}))::text`);
        params.push(slaHours);
        idx++;
      } else {
        fields.push("diagnosis_due_at = NULL");
      }
      fields.push("diagnosis_last_reminded_at = NULL");
    }
  }
  if (updates.etaAt !== undefined) {
    fields.push(`eta_at = $${idx}`);
    params.push(updates.etaAt || null);
    idx++;
  }
  if (updates.scheduledAt !== undefined) {
    fields.push(`scheduled_at = $${idx}`);
    params.push(updates.scheduledAt || null);
    idx++;
  }
  if (updates.scheduledDurationMinutes !== undefined) {
    fields.push(`scheduled_duration_minutes = $${idx}`);
    params.push(nextDuration);
    idx++;
  }
  if (updates.diagnosis !== undefined) {
    fields.push(`diagnosis = $${idx}`);
    params.push(updates.diagnosis);
    idx++;
    const diagnosisText = String(updates.diagnosis).trim();
    const previousDiagnosis = String(existing.diagnosis || "").trim();
    if (nextStatus !== "on_hold" && diagnosisText && !previousDiagnosis) {
      fields.push("diagnosis_recorded_at = NOW()::text");
      fields.push("diagnosis_last_reminded_at = NULL");
    } else if (nextStatus !== "on_hold" && !diagnosisText) {
      fields.push("diagnosis_recorded_at = NULL");
      fields.push("diagnosis_last_reminded_at = NULL");
    }
    if (nextServiceKind === "diagnosis_repair" && nextStatus !== "on_hold" && !diagnosisText && (assignedChanged || !existing.diagnosisDueAt || previousDiagnosis) && (updates.assignedTo !== undefined ? updates.assignedTo : existing.assignedTo) && !["collected", "cancelled", "on_hold"].includes(nextStatus)) {
      const slaHours = Math.min(168, Math.max(1, Number(await getStoreSetting("repair_diagnosis_sla_hours")) || 24));
      fields.push(`diagnosis_due_at = (NOW() + make_interval(hours => $${idx}))::text`);
      params.push(slaHours);
      idx++;
    } else if (nextStatus !== "on_hold" && diagnosisText && !previousDiagnosis && !existing.diagnosisDueAt) {
      fields.push("diagnosis_due_at = NULL");
    }
  }
  if (nextStatus === "on_hold") {
    fields.push("diagnosis_due_at = NULL");
    fields.push(`hold_reason = $${idx}`); params.push(nextHoldReason); idx++;
    fields.push(`hold_remind_at = $${idx}`); params.push(new Date(String(nextHoldRemindAt)).toISOString()); idx++;
    if (existing.status !== "on_hold") {
      fields.push("hold_started_at = NOW()::text");
      fields.push("hold_last_reminded_at = NULL");
    }
  } else if (existing.status === "on_hold") {
    fields.push("hold_reason = ''");
    fields.push("hold_remind_at = NULL");
    fields.push("hold_started_at = NULL");
    fields.push("hold_last_reminded_at = NULL");
    if (nextServiceKind === "diagnosis_repair" && !assignedChanged && !String(updates.diagnosis ?? existing.diagnosis).trim() && existing.assignedTo) {
      const slaHours = Math.min(168, Math.max(1, Number(await getStoreSetting("repair_diagnosis_sla_hours")) || 24));
      fields.push(`diagnosis_due_at = (NOW() + make_interval(hours => $${idx}))::text`);
      params.push(slaHours);
      idx++;
      fields.push("diagnosis_last_reminded_at = NULL");
    }
  }
  if (updates.workNotes !== undefined) {
    fields.push(`work_notes = $${idx}`);
    params.push(updates.workNotes);
    idx++;
  }
  if (updates.customerNotes !== undefined) {
    fields.push(`customer_notes = $${idx}`);
    params.push(updates.customerNotes);
    idx++;
  }
  if (updates.deviceType !== undefined) {
    fields.push(`device_type = $${idx}`);
    params.push(updates.deviceType);
    idx++;
  }
  if (updates.deviceModel !== undefined) {
    fields.push(`device_model = $${idx}`);
    params.push(updates.deviceModel);
    idx++;
  }
  if (updates.issueDescription !== undefined) {
    fields.push(`issue_description = $${idx}`);
    params.push(updates.issueDescription);
    idx++;
  }
  if (updates.repairType !== undefined) {
    fields.push(`repair_type = $${idx}`);
    params.push(updates.repairType || null);
    idx++;
  }
  if (updates.hardwareValue !== undefined) {
    fields.push(`hardware_value = $${idx}`);
    params.push(updates.hardwareValue);
    idx++;
  }
  if (updates.softwareInstall !== undefined) {
    fields.push(`software_install = $${idx}`);
    params.push(updates.softwareInstall ? 1 : 0);
    idx++;
  }
  if (licenseChanged) {
    fields.push(`software_license = $${idx}`);
    params.push(nextSoftwareLicense ? 1 : 0);
    idx++;
    fields.push(`software_license_product_id = $${idx}`);
    params.push(nextLicenseProductId);
    idx++;
    fields.push(`software_license_price = $${idx}`);
    params.push(nextLicensePrice);
    idx++;
  }

  if (!fields.length) return await loadTicketDetails(ticketId);

  const pCost = await queryOne("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = $1", [ticketId]) as { c: number };
  const partsCost = pCost?.c || 0;
  const repairType = updates.repairType !== undefined ? updates.repairType : existing.repairType;
  const hwValue = updates.hardwareValue !== undefined ? updates.hardwareValue : existing.hardwareValue;
  const swInstall = updates.softwareInstall !== undefined ? updates.softwareInstall : existing.softwareInstall;
  const totalCost = await calculateRepairCost(repairType, hwValue, partsCost, swInstall, nextLicensePrice);
  const laborCost = totalCost - partsCost - nextLicensePrice;

  fields.push(`labor_cost = $${idx}`);
  params.push(laborCost);
  idx++;
  fields.push(`parts_cost = $${idx}`);
  params.push(partsCost);
  idx++;
  fields.push(`total_cost = $${idx}`);
  params.push(totalCost);
  idx++;
  const estimateChanged = Math.abs(Number(existing.totalCost || 0) - Number(totalCost || 0)) >= 0.01;
  const quoteDetailsChanged =
    (updates.deviceType !== undefined && updates.deviceType !== existing.deviceType) ||
    (updates.deviceModel !== undefined && updates.deviceModel !== existing.deviceModel) ||
    (updates.issueDescription !== undefined && updates.issueDescription !== existing.issueDescription);
  const quoteInvalidated = !!existing.quoteSentAt && (estimateChanged || quoteDetailsChanged);
  if (quoteInvalidated) {
    // A customer response applies only to the exact estimate they received.
    // Any change to the price or quoted device/request requires an explicit resend.
    fields.push("quote_sent_at = NULL");
    fields.push("quote_response = NULL");
    fields.push("quote_responded_at = NULL");
  }
  fields.push("updated_at = NOW()::text");

  params.push(ticketId);
  const updateSql = `UPDATE repair_tickets SET ${fields.join(", ")} WHERE id = $${idx}`;
  if (scheduleChanged && nextSchedule && nextAssignee && !["collected", "cancelled"].includes(nextStatus)) {
    const scheduleResult = await transaction(async (client) => {
      await client.query("SELECT id FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
      if (quoteInvalidated) {
        const quoteInFlight = (await client.query("SELECT 1 FROM repair_quote_versions WHERE ticket_id = $1 AND delivery_status = 'sending' LIMIT 1", [ticketId])).rows?.[0];
        if (quoteInFlight) return { error: "A quote email is being sent. Wait for it to finish before changing the estimate.", conflict: true };
      }
      // Serialize every appointment write for this technician. Without this
      // transaction-scoped lock, two concurrent saves could both pass the
      // overlap query and double-book the same slot.
      await client.query("SELECT pg_advisory_xact_lock(927361, $1::integer)", [nextAssignee]);
      const conflict = (await client.query(
        `SELECT id, scheduled_at, scheduled_duration_minutes
         FROM repair_tickets
         WHERE assigned_to = $1 AND id <> $2
           AND scheduled_at IS NOT NULL
           AND status NOT IN ('collected', 'cancelled')
           AND scheduled_at::timestamp < $3::timestamp + make_interval(mins => $4)
           AND scheduled_at::timestamp + make_interval(mins => scheduled_duration_minutes) > $3::timestamp
         ORDER BY scheduled_at::timestamp ASC LIMIT 1`,
        [nextAssignee, ticketId, nextSchedule, nextDuration]
      )).rows?.[0];
      if (conflict) {
        const start = String(conflict.scheduled_at).replace("T", " ").slice(0, 16);
        return { error: `This technician is already booked on repair #${conflict.id} at ${start} for ${conflict.scheduled_duration_minutes} minutes. Choose another time or technician.`, conflict: true };
      }
      const updated = await client.query(updateSql, params);
      if ((updated.rowCount ?? 0) === 0) return { error: "The repair ticket could not be updated. Refresh it and try again.", conflict: true };
      return null;
    });
    if (scheduleResult) return scheduleResult;
  } else {
    const writeResult = await transaction(async (client) => {
      await client.query("SELECT id FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
      if (quoteInvalidated) {
        const quoteInFlight = (await client.query("SELECT 1 FROM repair_quote_versions WHERE ticket_id = $1 AND delivery_status = 'sending' LIMIT 1", [ticketId])).rows?.[0];
        if (quoteInFlight) return { conflict: true };
      }
      const updated = await client.query(updateSql, params);
      return { conflict: (updated.rowCount ?? 0) === 0 };
    });
    if (writeResult.conflict) return { error: "A quote email may be in progress or the ticket changed. Refresh it and try again." };
  }

  if (updates.status && updates.status !== existing.status) {
    await addRepairUpdate(
      ticketId,
      staffId || null,
      "status",
      `Status changed to ${STATUS_LABELS[updates.status]}.`,
      true
    );
  }

  if (updates.assignedTo !== undefined && Number(updates.assignedTo || 0) !== Number(existing.assignedTo || 0)) {
    await addRepairUpdate(
      ticketId,
      staffId || null,
      "assignment",
      `Technician reassigned (${existing.assignedTo || "unassigned"} -> ${updates.assignedTo || "unassigned"}).`,
      false
    );
  }
  if (updates.priority !== undefined && updates.priority !== existing.priority) {
    await addRepairUpdate(ticketId, staffId || null, "priority", `Priority changed from ${existing.priority || "normal"} to ${updates.priority}.`, false);
  }
  if (updates.etaAt !== undefined && String(updates.etaAt || "") !== String(existing.etaAt || "")) {
    await addRepairUpdate(ticketId, staffId || null, "eta_updated", `Estimated completion date changed to ${updates.etaAt || "not set"}.`, false);
  }
  if (updates.scheduledAt !== undefined && String(updates.scheduledAt || "") !== String(existing.scheduledAt || "")) {
    await addRepairUpdate(ticketId, staffId || null, "schedule_updated", `Repair schedule changed to ${updates.scheduledAt || "not scheduled"}.`, false);
  }
  if (quoteInvalidated) {
    const message = estimateChanged
      ? `Repair estimate changed from ${Number(existing.totalCost || 0).toFixed(2)} to ${Number(totalCost || 0).toFixed(2)}; the prior quote is no longer current.`
      : "The quoted device or request details changed; the prior quote is no longer current.";
    await addRepairUpdate(ticketId, staffId || null, "quote_updated", message, false);
  }
  if (updates.diagnosis !== undefined && String(updates.diagnosis).trim() !== String(existing.diagnosis || "").trim()) {
    await addRepairUpdate(ticketId, staffId || null, "diagnosis", String(updates.diagnosis).trim() ? "Diagnosis recorded or updated." : "Diagnosis cleared; the diagnosis target restarted.", false);
  }
  if (nextStatus === "on_hold" && existing.status !== "on_hold") {
    await addRepairUpdate(ticketId, staffId || null, "hold", `Ticket placed on hold. Reason: ${nextHoldReason}. Review due ${new Date(String(nextHoldRemindAt)).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}.`, false);
  } else if (nextStatus === "on_hold" && (nextHoldReason !== existing.holdReason || String(nextHoldRemindAt || "") !== String(existing.holdRemindAt || ""))) {
    await addRepairUpdate(ticketId, staffId || null, "hold_review_updated", `On-hold reason or review date updated. Review due ${new Date(String(nextHoldRemindAt)).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })}.`, false);
  } else if (existing.status === "on_hold" && nextStatus !== "on_hold") {
    await addRepairUpdate(ticketId, staffId || null, "hold_released", `Ticket resumed with status ${STATUS_LABELS[nextStatus] || nextStatus}.`, false);
  }

  return await loadTicketDetails(ticketId);
}

export async function runRepairWorkflowSweep(): Promise<{ diagnosisEscalated: any[]; holdReminders: any[]; quotesExpired: any[]; quotesSuperseded: any[] }> {
  const diagnosisEscalated = await queryAll(`
    WITH due AS (
      SELECT t.id, t.assigned_to FROM repair_tickets t
      WHERE t.assigned_to IS NOT NULL AND t.diagnosis_due_at IS NOT NULL
        AND t.diagnosis_due_at::timestamptz <= NOW()
        AND t.diagnosis = '' AND t.status IN ('received', 'diagnosing')
        AND (t.diagnosis_last_reminded_at IS NULL OR t.diagnosis_last_reminded_at::timestamptz <= NOW() - INTERVAL '23 hours')
      ORDER BY t.diagnosis_due_at LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    UPDATE repair_tickets t SET
      priority = CASE t.priority WHEN 'low' THEN 'normal' WHEN 'normal' THEN 'high' WHEN 'high' THEN 'critical' ELSE 'critical' END,
      diagnosis_last_reminded_at = NOW()::text,
      updated_at = NOW()::text
    FROM due d LEFT JOIN users u ON u.id = d.assigned_to
    WHERE t.id = d.id
    RETURNING t.id, t.priority, u.username AS assigned_name, u.email AS assigned_email
  `) as any[];

  const holdReminders = await queryAll(`
    WITH due AS (
      SELECT t.id, t.assigned_to FROM repair_tickets t
      WHERE t.status = 'on_hold' AND t.hold_remind_at IS NOT NULL
        AND t.hold_remind_at::timestamptz <= NOW()
        AND (t.hold_last_reminded_at IS NULL OR t.hold_last_reminded_at::timestamptz <= NOW() - INTERVAL '23 hours')
      ORDER BY t.hold_remind_at LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    UPDATE repair_tickets t SET hold_last_reminded_at = NOW()::text, updated_at = NOW()::text
    FROM due d LEFT JOIN users u ON u.id = d.assigned_to
    WHERE t.id = d.id
    RETURNING t.id, t.hold_reason, t.priority, u.username AS assigned_name, u.email AS assigned_email
  `) as any[];
  const quotesExpired = await queryAll(
    `UPDATE repair_quote_versions SET delivery_status = 'expired', delivery_result = 'expired'
     WHERE delivery_status = 'sent' AND expires_at <= NOW()
     RETURNING ticket_id, version`
  ) as any[];
  const quotesSuperseded = await queryAll(
    `UPDATE repair_quote_versions q SET delivery_status = 'superseded', delivery_result = 'estimate_changed'
     FROM repair_tickets t
     WHERE t.id = q.ticket_id AND q.delivery_status = 'sent' AND q.expires_at > NOW()
       AND t.quote_sent_at IS DISTINCT FROM q.reservation_token
     RETURNING q.ticket_id, q.version`
  ) as any[];
  return { diagnosisEscalated, holdReminders, quotesExpired, quotesSuperseded };
}

const REPAIR_PAYMENT_METHODS = ["cash", "mpesa", "card", "bank_transfer", "other"] as const;
type RepairPaymentKind = "payment" | "refund";

export class RepairPaymentError extends Error {
  constructor(message: string) { super(message); this.name = "RepairPaymentError"; }
}

function moneyToCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) throw new RepairPaymentError("Enter an amount greater than zero with no more than two decimal places.");
  const cents = Math.round(amount * 100);
  if (Math.abs(amount - cents / 100) > 0.000001) throw new RepairPaymentError("Enter an amount with no more than two decimal places.");
  return cents;
}

export async function listRepairPaymentLedger(ticketId: string): Promise<any | null> {
  const ticket = await queryOne("SELECT total_cost FROM repair_tickets WHERE id = $1", [ticketId]) as any;
  if (!ticket) return null;
  const entries = await queryAll(
    `SELECT rp.id, rp.kind, rp.amount, rp.payment_method, rp.reference, rp.related_payment_id,
            original.reference AS related_reference, rp.reason, rp.created_at,
            rp.created_by AS created_by_id, u.username AS created_by,
            voiding.id AS voided_by_entry_id, voiding.reason AS void_reason,
            voiding.created_at AS voided_at, voider.username AS voided_by
     FROM repair_payments rp
     LEFT JOIN repair_payments original ON original.id = rp.related_payment_id
     LEFT JOIN users u ON u.id = rp.created_by
     LEFT JOIN repair_payments voiding ON voiding.kind = 'void' AND voiding.related_payment_id = rp.id
     LEFT JOIN users voider ON voider.id = voiding.created_by
     WHERE rp.ticket_id = $1 ORDER BY rp.created_at DESC, rp.id DESC`,
    [ticketId]
  );
  const totals = await queryOne(
    `SELECT COALESCE(SUM(rp.amount) FILTER (WHERE rp.kind = 'payment' AND voiding.id IS NULL),0) AS received,
            COALESCE(SUM(rp.amount) FILTER (WHERE rp.kind = 'refund' AND voiding.id IS NULL),0) AS refunded,
            COUNT(voiding.id)::int AS voided_entries
     FROM repair_payments rp
     LEFT JOIN repair_payments voiding ON voiding.kind = 'void' AND voiding.related_payment_id = rp.id
     WHERE rp.ticket_id = $1 AND rp.kind IN ('payment','refund')`,
    [ticketId]
  ) as any;
  const received = Number(totals?.received || 0);
  const refunded = Number(totals?.refunded || 0);
  const netReceived = Math.max(0, Math.round((received - refunded) * 100) / 100);
  const estimate = Math.max(0, Number(ticket.total_cost || 0));
  return {
    entries: entries.map((r: any) => ({
      id: Number(r.id), kind: r.kind, amount: Number(r.amount), paymentMethod: r.payment_method,
      reference: r.reference, relatedPaymentId: r.related_payment_id == null ? null : Number(r.related_payment_id),
      relatedReference: r.related_reference || null, reason: r.reason || "", createdAt: r.created_at,
      createdById: r.created_by_id == null ? null : Number(r.created_by_id), createdBy: r.created_by || "Staff",
      voided: r.voided_by_entry_id != null, voidedAt: r.voided_at || null,
      voidReason: r.void_reason || "", voidedBy: r.voided_by || null,
    })),
    summary: { estimate, received, refunded, netReceived, balance: Math.max(0, Math.round((estimate - netReceived) * 100) / 100), voidedEntries: Number(totals?.voided_entries || 0) },
  };
}

export async function recordRepairLedgerEntry(ticketId: string, input: {
  kind: RepairPaymentKind; amount: unknown; paymentMethod?: unknown; reference: unknown;
  relatedPaymentId?: unknown; reason?: unknown; idempotencyKey: unknown; staffId: number;
}): Promise<any> {
  const amountCents = moneyToCents(input.amount);
  const kind = input.kind;
  if (kind !== "payment" && kind !== "refund") throw new RepairPaymentError("Choose payment or refund.");
  const reference = String(input.reference ?? "").trim().slice(0, 128);
  if (!reference) throw new RepairPaymentError("Enter the receipt or refund reference.");
  const idempotencyKey = String(input.idempotencyKey ?? "").trim().slice(0, 128);
  if (!idempotencyKey) throw new RepairPaymentError("The request key is missing. Please retry.");
  const reason = String(input.reason ?? "").trim().slice(0, 500);
  if (kind === "refund" && !reason) throw new RepairPaymentError("Enter a reason for the refund.");
  const relatedPaymentId = input.relatedPaymentId == null ? null : Number(input.relatedPaymentId);
  if (kind === "refund" && (!Number.isSafeInteger(relatedPaymentId) || Number(relatedPaymentId) <= 0)) throw new RepairPaymentError("Choose the original payment to refund.");
  let paymentMethod = String(input.paymentMethod ?? "").trim().toLowerCase();
  if (!REPAIR_PAYMENT_METHODS.includes(paymentMethod as any)) throw new RepairPaymentError("Choose a supported payment method.");

  try {
  return await transaction(async (client) => {
    const prior = (await client.query("SELECT * FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
    if (prior) {
      const matches = String(prior.ticket_id) === ticketId && prior.kind === kind && Math.round(Number(prior.amount) * 100) === amountCents && prior.reference === reference && prior.payment_method === paymentMethod && String(prior.reason || "") === reason && (prior.related_payment_id == null ? null : Number(prior.related_payment_id)) === relatedPaymentId;
      if (!matches) throw new RepairPaymentError("This request key was already used for a different ledger entry.");
      return prior;
    }

    const ticket = (await client.query("SELECT id, total_cost, status FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId])).rows?.[0] as any;
    if (!ticket) throw new RepairPaymentError("Repair ticket not found.");
    const afterLock = (await client.query("SELECT * FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
    if (afterLock) {
      const matches = String(afterLock.ticket_id) === ticketId && afterLock.kind === kind && Math.round(Number(afterLock.amount) * 100) === amountCents && afterLock.reference === reference && afterLock.payment_method === paymentMethod && String(afterLock.reason || "") === reason && (afterLock.related_payment_id == null ? null : Number(afterLock.related_payment_id)) === relatedPaymentId;
      if (!matches) throw new RepairPaymentError("This request key was already used for a different ledger entry.");
      return afterLock;
    }
    if (kind === "payment") {
      if (["cancelled", "rejected"].includes(String(ticket.status))) throw new RepairPaymentError("A payment cannot be recorded against a cancelled or rejected repair.");
      const sums = (await client.query(
        `SELECT COALESCE(SUM(rp.amount) FILTER (WHERE rp.kind = 'payment' AND voiding.id IS NULL),0) AS received,
                COALESCE(SUM(rp.amount) FILTER (WHERE rp.kind = 'refund' AND voiding.id IS NULL),0) AS refunded
         FROM repair_payments rp
         LEFT JOIN repair_payments voiding ON voiding.kind = 'void' AND voiding.related_payment_id = rp.id
         WHERE rp.ticket_id = $1 AND rp.kind IN ('payment','refund')`, [ticketId]
      )).rows?.[0] as any;
      const netCents = Math.round((Number(sums?.received || 0) - Number(sums?.refunded || 0)) * 100);
      const estimateCents = Math.max(0, Math.round(Number(ticket.total_cost || 0) * 100));
      if (amountCents > estimateCents - netCents) throw new RepairPaymentError(`Payment exceeds the remaining repair estimate (${Math.max(0, (estimateCents - netCents) / 100).toFixed(2)}). Update and approve the estimate before recording more.`);
    } else {
      const original = (await client.query("SELECT id, ticket_id, amount, payment_method FROM repair_payments WHERE id = $1 AND kind = 'payment' FOR UPDATE", [relatedPaymentId])).rows?.[0] as any;
      if (!original || original.ticket_id !== ticketId) throw new RepairPaymentError("The selected payment does not belong to this repair.");
      const originalVoid = (await client.query("SELECT id FROM repair_payments WHERE kind = 'void' AND related_payment_id = $1", [relatedPaymentId])).rows?.[0];
      if (originalVoid) throw new RepairPaymentError("A refund cannot be linked to a voided receipt.");
      if (paymentMethod !== original.payment_method) throw new RepairPaymentError("Refund method must match the original payment method.");
      const refunded = (await client.query(
        `SELECT COALESCE(SUM(rp.amount),0) AS total FROM repair_payments rp
         LEFT JOIN repair_payments voiding ON voiding.kind = 'void' AND voiding.related_payment_id = rp.id
         WHERE rp.kind = 'refund' AND rp.related_payment_id = $1 AND voiding.id IS NULL`, [relatedPaymentId]
      )).rows?.[0] as any;
      const refundableCents = Math.round((Number(original.amount) - Number(refunded?.total || 0)) * 100);
      if (amountCents > refundableCents) throw new RepairPaymentError(`Refund exceeds the remaining amount on this receipt (${Math.max(0, refundableCents / 100).toFixed(2)}).`);
    }

    const inserted = (await client.query(
      `INSERT INTO repair_payments (ticket_id, kind, amount, payment_method, reference, related_payment_id, reason, idempotency_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, kind, amount, payment_method, reference, related_payment_id, reason, created_at`,
      [ticketId, kind, amountCents / 100, paymentMethod, reference, relatedPaymentId, reason, idempotencyKey, input.staffId]
    )).rows?.[0] as any;
    if (!inserted) {
      const raced = (await client.query("SELECT * FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
      const matches = raced && String(raced.ticket_id) === ticketId && raced.kind === kind && Math.round(Number(raced.amount) * 100) === amountCents && raced.reference === reference && raced.payment_method === paymentMethod && String(raced.reason || "") === reason && (raced.related_payment_id == null ? null : Number(raced.related_payment_id)) === relatedPaymentId;
      if (!matches) throw new RepairPaymentError("This request key was already used for a different ledger entry.");
      return raced;
    }
    const message = kind === "payment"
      ? `Repair payment recorded: KES ${(amountCents / 100).toFixed(2)} via ${paymentMethod} (reference ${reference}).`
      : `Repair refund recorded: KES ${(amountCents / 100).toFixed(2)} via ${paymentMethod} (reference ${reference}); reason: ${reason}.`;
    await client.query(
      "INSERT INTO repair_updates (ticket_id, staff_id, update_type, message, customer_visible) VALUES ($1,$2,$3,$4,0)",
      [ticketId, input.staffId, kind === "payment" ? "payment_received" : "payment_refunded", message]
    );
    return { ...inserted, created_by: null };
  });
  } catch (err: any) {
    if (err?.code === "23505") throw new RepairPaymentError("That reference has already been recorded for this ticket and payment method.");
    throw err;
  }
}

export async function voidRepairLedgerEntry(ticketId: string, entryId: unknown, input: {
  reason: unknown; idempotencyKey: unknown; staffId: number;
}): Promise<void> {
  const targetId = Number(entryId);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) throw new RepairPaymentError("Choose a valid payment or refund entry.");
  const reason = String(input.reason ?? "").trim().slice(0, 500);
  if (!reason) throw new RepairPaymentError("Enter a reason for voiding this entry.");
  const idempotencyKey = String(input.idempotencyKey ?? "").trim().slice(0, 128);
  if (!idempotencyKey) throw new RepairPaymentError("The request key is missing. Please retry.");

  try {
    await transaction(async (client) => {
      const prior = (await client.query("SELECT * FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
      if (prior) {
        const matches = String(prior.ticket_id) === ticketId && prior.kind === "void" && Number(prior.related_payment_id) === targetId && String(prior.reason || "") === reason;
        if (!matches) throw new RepairPaymentError("This request key was already used for a different ledger entry.");
        return;
      }

      const ticket = (await client.query("SELECT id FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId])).rows?.[0];
      if (!ticket) throw new RepairPaymentError("Repair ticket not found.");
      const afterLock = (await client.query("SELECT * FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
      if (afterLock) {
        const matches = String(afterLock.ticket_id) === ticketId && afterLock.kind === "void" && Number(afterLock.related_payment_id) === targetId && String(afterLock.reason || "") === reason;
        if (!matches) throw new RepairPaymentError("This request key was already used for a different ledger entry.");
        return;
      }
      const target = (await client.query(
        "SELECT id, kind, amount, payment_method FROM repair_payments WHERE id = $1 AND ticket_id = $2 FOR UPDATE",
        [targetId, ticketId]
      )).rows?.[0] as any;
      if (!target || !["payment", "refund"].includes(String(target.kind))) throw new RepairPaymentError("Only a payment or refund entry on this ticket can be voided.");
      const priorVoid = (await client.query("SELECT id FROM repair_payments WHERE kind = 'void' AND related_payment_id = $1", [targetId])).rows?.[0];
      if (priorVoid) throw new RepairPaymentError("This ledger entry has already been voided.");

      if (target.kind === "payment") {
        const activeRefund = (await client.query(
          `SELECT 1 FROM repair_payments refund
           LEFT JOIN repair_payments voiding ON voiding.kind = 'void' AND voiding.related_payment_id = refund.id
           WHERE refund.kind = 'refund' AND refund.related_payment_id = $1 AND voiding.id IS NULL LIMIT 1`,
          [targetId]
        )).rows?.[0];
        if (activeRefund) throw new RepairPaymentError("Void the related refund first. A receipt with an active refund cannot be voided.");
      }

      const reference = `VOID-${targetId}-${idempotencyKey}`.slice(0, 128);
      const inserted = (await client.query(
        `INSERT INTO repair_payments (ticket_id, kind, amount, payment_method, reference, related_payment_id, reason, idempotency_key, created_by)
         VALUES ($1, 'void', $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [ticketId, target.amount, target.payment_method, reference, targetId, reason, idempotencyKey, input.staffId]
      )).rows?.[0];
      if (!inserted) {
        const raced = (await client.query("SELECT ticket_id, related_payment_id, reason, kind FROM repair_payments WHERE idempotency_key = $1", [idempotencyKey])).rows?.[0] as any;
        if (raced && String(raced.ticket_id) === ticketId && raced.kind === "void" && Number(raced.related_payment_id) === targetId && String(raced.reason || "") === reason) return;
        throw new RepairPaymentError("This request key was already used for a different ledger entry.");
      }
      const message = `Repair ${target.kind} entry ${targetId} voided (${reference}). Reason: ${reason}.`;
      await client.query(
        "INSERT INTO repair_updates (ticket_id, staff_id, update_type, message, customer_visible) VALUES ($1,$2,'payment_voided',$3,0)",
        [ticketId, input.staffId, message]
      );
    });
  } catch (err: any) {
    if (err instanceof RepairPaymentError) throw err;
    if (err?.code === "23505") throw new RepairPaymentError("This ledger entry has already been voided.");
    throw err;
  }
}

async function addRepairUpdate(ticketId: string, staffId: number | null, updateType: string, message: string, customerVisible: boolean = false): Promise<number> {
  const row = await queryOne(
    `INSERT INTO repair_updates (ticket_id, staff_id, update_type, message, customer_visible)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ticketId, staffId, updateType, message, customerVisible ? 1 : 0]
  ) as { id: number };
  return Number(row.id);
}

async function addRepairPart(ticketId: string, data: any, staffId?: number): Promise<TicketResult> {
  const desc = String(data.description || "").trim();
  if (!desc) return { ok: false, error: "Part description is required." };

  const qty = Math.max(1, Number(data.quantity) || 1);
  const cost = Number(data.unitCost) || 0;
  const productId = data.productId ? String(data.productId) : null;

  // A part drawn from store inventory must leave stock, and the stock deduction
  // must be atomic with the repair_parts_used insert: if the guarded deduction
  // finds insufficient stock we throw, rolling back the whole transaction so a
  // part is never recorded without an accompanying deduction.
  let partId: number;
  try {
    partId = await transaction(async (client) => {
      await client.query("SELECT id FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
      const quoteInFlight = (await client.query("SELECT 1 FROM repair_quote_versions WHERE ticket_id = $1 AND delivery_status = 'sending' LIMIT 1", [ticketId])).rows?.[0];
      if (quoteInFlight) throw new Error("A quote email is being sent. Wait for it to finish before changing the estimate parts.");
      if (productId) {
        const level = (await client.query("SELECT quantity_in_stock, quantity_reserved FROM stock_levels WHERE product_id = $1 AND branch_id IS NULL FOR UPDATE", [productId])).rows?.[0] as any;
        // Guarded atomic deduction — rowCount 0 means insufficient stock on hand.
        const prodRes = await client.query(
          "UPDATE products SET stock_on_hand = GREATEST(stock_on_hand - $1, 0) WHERE id = $2 AND stock_on_hand >= $1",
          [qty, productId]
        );
        if ((prodRes.rowCount ?? 0) === 0) {
          throw new Error(`Insufficient stock for ${desc}.`);
        }
        if (level) {
          await client.query("UPDATE stock_levels SET quantity_in_stock = GREATEST(quantity_in_stock - $1, 0), updated_at = NOW()::text WHERE product_id = $2 AND branch_id IS NULL", [qty, productId]);
        }
        await client.query(
          "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes) VALUES ($1, 'repair_part', $2, 'repair', $3, $4)",
          [productId, -qty, ticketId, `Repair part used #${ticketId}`]
        );
      }
      const result = await client.query(
        `INSERT INTO repair_parts_used (ticket_id, description, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [ticketId, desc, productId, qty, cost]
      );
      return Number(result.rows[0]?.id);
    });
  } catch (e: any) {
    // Caller surfaces the error via result.error (HTTP 400) in index.ts:4780.
    return { ok: false, error: String(e?.message || "Insufficient stock.") };
  }

  await recalculateTicketCost(ticketId);

  const partRow = await queryOne("SELECT * FROM repair_parts_used WHERE id = $1", [partId]) as any;
  await addRepairUpdate(ticketId, staffId || null, "part_added", `Part added: ${desc} × ${qty} (unit cost ${Number(cost).toFixed(2)}).`, false);
  return { ok: true, part: mapPart(partRow) };
}

async function removeRepairPart(ticketId: string, partId: number, staffId?: number): Promise<boolean> {
  const part = await transaction(async (client) => {
    await client.query("SELECT id FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
    const quoteInFlight = (await client.query("SELECT 1 FROM repair_quote_versions WHERE ticket_id = $1 AND delivery_status = 'sending' LIMIT 1", [ticketId])).rows?.[0];
    if (quoteInFlight) throw new Error("A quote email is being sent. Wait for it to finish before changing the estimate parts.");
    const row = (await client.query("SELECT description, product_id, quantity FROM repair_parts_used WHERE id = $1 AND ticket_id = $2 FOR UPDATE", [partId, ticketId])).rows?.[0] as any;
    if (!row) return null;
    const deleted = await client.query("DELETE FROM repair_parts_used WHERE id = $1 AND ticket_id = $2", [partId, ticketId]);
    if ((deleted.rowCount ?? 0) === 0) return null;
    if (row.product_id) {
      const qty = Number(row.quantity) || 1;
      await client.query("UPDATE products SET stock_on_hand = stock_on_hand + $1 WHERE id = $2", [qty, row.product_id]);
      await client.query("UPDATE stock_levels SET quantity_in_stock = quantity_in_stock + $1, updated_at = NOW()::text WHERE product_id = $2 AND branch_id IS NULL", [qty, row.product_id]);
      await client.query(
        "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes) VALUES ($1, 'restock', $2, 'repair', $3, $4)",
        [row.product_id, qty, ticketId, `Repair part removed #${ticketId}`]
      );
    }
    return row;
  });
  if (!part) return false;
  await recalculateTicketCost(ticketId);
  await addRepairUpdate(ticketId, staffId || null, "part_removed", `Part removed: ${part.description || "part"} × ${Number(part.quantity) || 1}.`, false);
  return true;
}

async function recalculateTicketCost(ticketId: string): Promise<void> {
  const ticket = await loadTicketDetails(ticketId);
  if (!ticket) return;
  const pCost = await queryOne("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = $1", [ticketId]) as { c: number };
  const partsCost = pCost?.c || 0;
  const totalCost = await calculateRepairCost(ticket.repairType, ticket.hardwareValue, partsCost, ticket.softwareInstall, ticket.softwareLicensePrice);
  const laborCost = totalCost - partsCost - ticket.softwareLicensePrice;
  const quoteInvalidation = ticket.quoteSentAt && Math.abs(Number(ticket.totalCost || 0) - Number(totalCost || 0)) >= 0.01
    ? ", quote_sent_at = NULL, quote_response = NULL, quote_responded_at = NULL"
    : "";
  await query(`UPDATE repair_tickets SET labor_cost = $1, parts_cost = $2, total_cost = $3${quoteInvalidation}, updated_at = NOW()::text WHERE id = $4`, [laborCost, partsCost, totalCost, ticketId]);
}

async function getDashboardStats(): Promise<DashboardStats> {
  const open = await queryOne(`SELECT COUNT(*) AS c FROM repair_tickets WHERE status NOT IN ('collected', 'cancelled')`) as { c: number };
  const dueToday = await queryOne(`SELECT COUNT(*) AS c FROM repair_tickets
     WHERE status NOT IN ('collected', 'cancelled')
     AND (eta_at::date) <= (NOW()::date)`) as { c: number };
  const scheduledToday = await queryOne(`SELECT COUNT(*) AS c FROM repair_tickets
     WHERE scheduled_at IS NOT NULL
     AND (scheduled_at::date) = (NOW()::date)
     AND status NOT IN ('collected', 'cancelled')`) as { c: number };
  const unassigned = await queryOne(`SELECT COUNT(*) AS c FROM repair_tickets
     WHERE assigned_to IS NULL AND status NOT IN ('collected', 'cancelled')`) as { c: number };

  return { openRepairs: Number(open?.c || 0), dueToday: Number(dueToday?.c || 0), scheduledToday: Number(scheduledToday?.c || 0), unassigned: Number(unassigned?.c || 0) };
}

async function listRepairTypes(): Promise<RepairType[]> {
  return await queryAll("SELECT id, name, description, base_price AS \"basePrice\" FROM repair_types ORDER BY name") as RepairType[];
}

interface RepairQuoteVersionResult { id: number; version: number; reservationToken: string; }

/** Persist the immutable estimate and reserve its send in one transaction. */
async function createRepairQuoteVersion(input: {
  ticketId: string; expectedTotal: number; expectedVersion: number; recipientEmail: string;
  snapshot: Record<string, unknown>; pdf: Buffer; expiresAt: string;
}): Promise<RepairQuoteVersionResult | null> {
  const pdfSha256 = createHash("sha256").update(input.pdf).digest("hex");
  return transaction(async (client) => {
    const ticket = (await client.query("SELECT quote_sent_at, total_cost FROM repair_tickets WHERE id = $1 FOR UPDATE", [input.ticketId])).rows?.[0] as any;
    if (!ticket || Math.abs(Number(ticket.total_cost || 0) - input.expectedTotal) >= 0.01) return null;

    const parts = (await client.query("SELECT description, quantity, unit_cost FROM repair_parts_used WHERE ticket_id = $1 ORDER BY id", [input.ticketId])).rows as any[];
    const actualParts = parts.map((part) => ({ description: String(part.description || "Part"), quantity: Number(part.quantity) || 1, unitCost: Number(part.unit_cost) || 0 }));
    const snapshotParts = Array.isArray(input.snapshot.parts) ? input.snapshot.parts : [];
    if (JSON.stringify(actualParts) !== JSON.stringify(snapshotParts)) return null;
    const storedPartsCost = parts.reduce((sum, part) => sum + (Number(part.quantity) || 1) * (Number(part.unit_cost) || 0), 0);
    if (Math.abs(storedPartsCost - Number((await client.query("SELECT parts_cost FROM repair_tickets WHERE id = $1", [input.ticketId])).rows?.[0]?.parts_cost || 0)) >= 0.01) return null;

    const previous = (await client.query(
      "SELECT id, version, delivery_status, expires_at, created_at FROM repair_quote_versions WHERE ticket_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE",
      [input.ticketId]
    )).rows?.[0] as any;
    if (ticket.quote_sent_at && previous?.delivery_status === "sent" && new Date(previous.expires_at).getTime() > Date.now()) return null;
    if (previous?.delivery_status === "sending" && new Date(previous.created_at).getTime() > Date.now() - 30 * 60 * 1000) return null;
    if (previous?.delivery_status === "sending") {
      await client.query("UPDATE repair_quote_versions SET delivery_status = 'failed', delivery_result = 'send_timed_out' WHERE id = $1", [previous.id]);
    }
    if (previous?.delivery_status === "sent") await client.query("UPDATE repair_quote_versions SET delivery_status = CASE WHEN expires_at <= NOW() THEN 'expired' ELSE 'superseded' END WHERE id = $1", [previous.id]);

    const nextVersion = Number((await client.query("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM repair_quote_versions WHERE ticket_id = $1", [input.ticketId])).rows?.[0]?.version || 1);
    if (nextVersion !== input.expectedVersion) return null;
    const reserved = (await client.query(
      `UPDATE repair_tickets SET quote_sent_at = NOW()::text, quote_response = NULL, quote_responded_at = NULL, updated_at = NOW()::text
       WHERE id = $1 RETURNING quote_sent_at`, [input.ticketId]
    )).rows?.[0] as any;
    const reservationToken = String(reserved?.quote_sent_at || "");
    if (!reservationToken) throw new Error("Could not reserve repair quote send.");
    const inserted = (await client.query(
      `INSERT INTO repair_quote_versions
        (ticket_id, version, recipient_email, quote_snapshot, pdf_content, pdf_sha256, reservation_token, delivery_status, delivery_result, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'sending', 'pending', $8::timestamptz)
       RETURNING id`,
      [input.ticketId, nextVersion, input.recipientEmail, JSON.stringify({ ...input.snapshot, version: nextVersion, expiresAt: input.expiresAt }), input.pdf, pdfSha256, reservationToken, input.expiresAt]
    )).rows?.[0] as any;
    return { id: Number(inserted.id), version: nextVersion, reservationToken };
  });
}

async function finishRepairQuoteVersion(versionId: number, sent: boolean): Promise<boolean> {
  const result = await transaction(async (client) => {
    const version = (await client.query("SELECT ticket_id, version, reservation_token, delivery_status FROM repair_quote_versions WHERE id = $1 FOR UPDATE", [versionId])).rows?.[0] as any;
    if (!version || version.delivery_status !== "sending") return null;
    if (!sent) {
      await client.query("UPDATE repair_quote_versions SET delivery_status = 'failed', delivery_result = 'email_not_delivered' WHERE id = $1", [versionId]);
      await client.query(
        `UPDATE repair_tickets SET quote_sent_at = NULL, quote_response = NULL, quote_responded_at = NULL, updated_at = NOW()::text
         WHERE id = $1 AND quote_sent_at = $2`, [version.ticket_id, version.reservation_token]
      );
      return { sent: false, ticketId: String(version.ticket_id), version: Number(version.version) };
    }
    await client.query("UPDATE repair_quote_versions SET delivery_status = 'sent', delivery_result = 'sent', sent_at = NOW() WHERE id = $1", [versionId]);
    return { sent: true, ticketId: String(version.ticket_id), version: Number(version.version) };
  });
  if (!result?.sent) return false;
  await addRepairUpdate(result.ticketId, null, "quote_sent", `Repair estimate v${result.version} PDF emailed. Please review and respond before it expires.`, true);
  return true;
}

async function loadCustomerRepairQuotePdf(ticketId: string, customerId: number): Promise<{ version: number; pdf: Buffer } | null> {
  const row = await queryOne(
    `SELECT q.version, q.pdf_content
     FROM repair_quote_versions q
     JOIN repair_tickets t ON t.id = q.ticket_id
     WHERE q.ticket_id = $1 AND t.customer_id = $2
       AND t.quote_sent_at = q.reservation_token
       AND q.delivery_status = 'sent' AND q.expires_at > NOW()
     ORDER BY q.version DESC LIMIT 1`,
    [ticketId, customerId]
  ) as any;
  if (!row?.pdf_content) return null;
  return { version: Number(row.version), pdf: Buffer.isBuffer(row.pdf_content) ? row.pdf_content : Buffer.from(row.pdf_content) };
}

async function respondToRepairQuote(ticketId: string, response: "accepted" | "declined"): Promise<boolean> {
  const result = await transaction(async (client) => {
    const ticket = (await client.query("SELECT customer_id, quote_sent_at FROM repair_tickets WHERE id = $1 FOR UPDATE", [ticketId])).rows?.[0] as any;
    if (!ticket?.quote_sent_at) return false;
    const version = (await client.query(
      `SELECT id, version, reservation_token FROM repair_quote_versions
       WHERE ticket_id = $1 AND delivery_status = 'sent' AND expires_at > NOW()
       ORDER BY version DESC LIMIT 1 FOR UPDATE`, [ticketId]
    )).rows?.[0] as any;
    if (!version || version.reservation_token !== String(ticket.quote_sent_at)) return false;
    const updated = await client.query(
      "UPDATE repair_quote_versions SET response = $1, responded_at = NOW() WHERE id = $2 AND response IS NULL",
      [response, version.id]
    );
    if ((updated.rowCount ?? 0) === 0) return false;
    await client.query(
      "UPDATE repair_tickets SET quote_response = $1, quote_responded_at = NOW()::text, updated_at = NOW()::text WHERE id = $2 AND quote_sent_at = $3",
      [response, ticketId, version.reservation_token]
    );
    return true;
  });
  if (!result) return false;
  await addRepairUpdate(ticketId, null, "quote_" + response, `Customer ${response} the cost estimate.`, true);
  return true;
}

export {
  STATUSES,
  STATUS_LABELS,
  isValidStatus,
  createRepairTicket,
  loadTicketDetails,
  listRepairsForCustomer,
  listCustomerRepairDevices,
  listRepairsForCustomerPaged,
  listRepairsForStaff,
  listCalendarRepairs,
  updateRepairTicket,
  addRepairUpdate,
  addRepairPart,
  removeRepairPart,
  getDashboardStats,
  listRepairTypes,
  calculateRepairCost,
  recalculateTicketCost,
  createRepairQuoteVersion,
  finishRepairQuoteVersion,
  loadCustomerRepairQuotePdf,
  respondToRepairQuote,
};
