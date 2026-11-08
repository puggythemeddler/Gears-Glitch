import { query, queryOne, queryAll, transaction } from "./db-helpers";
import { getStoreSetting } from "./db";

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
  totalCost: number;
  quoteSentAt: string | null;
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

async function calculateRepairCost(typeId: string | null, hardwareValue: number, partsCost: number, softwareInstall: boolean, softwareLicense: boolean): Promise<number> {
  let total = 0;
  if (typeId) {
    const rt = await queryOne("SELECT base_price FROM repair_types WHERE id = $1", [typeId]) as { base_price?: number } | undefined;
    if (rt?.base_price) total += rt.base_price;
    if (hardwareValue > 0) {
      total += Math.round(hardwareValue * 0.05);
    }
  }
  total += partsCost;
  // R-6: software labor fees are store-configurable via settings, falling back to
  // the historical KES defaults (800 install / 2500 license) when unset.
  const installFee = Number(await getStoreSetting("repair_software_install_fee")) || 800;
  const licenseFee = Number(await getStoreSetting("repair_software_license_fee")) || 2500;
  if (softwareInstall && !softwareLicense) total += installFee;
  if (softwareLicense) total += licenseFee;
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
    totalCost: row.total_cost || 0,
    quoteSentAt: row.quote_sent_at || null,
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
            u.username AS assigned_name
     FROM repair_tickets t
     JOIN customers c ON c.id = t.customer_id
     LEFT JOIN users u ON u.id = t.assigned_to
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

  return mapTicket(row, { parts, updates });
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

  if (!deviceType || !issueDescription) {
    return { ok: false, error: "Device type and problem description are required." };
  }
  const parsedVisitDate = requestedVisitDate ? new Date(`${requestedVisitDate}T00:00:00.000Z`) : null;
  if (requestedVisitDate && (!/^\d{4}-\d{2}-\d{2}$/.test(requestedVisitDate) || Number.isNaN(parsedVisitDate?.getTime()) || parsedVisitDate?.toISOString().slice(0, 10) !== requestedVisitDate)) {
    return { ok: false, error: "Preferred visit date must be a valid date." };
  }
  if (requestedVisitTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedVisitTime)) {
    return { ok: false, error: "Preferred visit time must use 24-hour time." };
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
    `INSERT INTO repair_tickets (id, customer_id, device_type, device_brand, device_model, serial_number, issue_summary, issue_description, customer_notes, requested_visit_date, requested_visit_time, repair_type, status, eta_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'received', (NOW() + make_interval(hours => $13))::text, NOW()::text, NOW()::text)`,
    [id, customerId, deviceType, deviceBrand, deviceModel, serialNumber, issueSummary, fullDescription, customerNotes, requestedVisitDate, requestedVisitTime, repairType, etaHours]
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
  const nextStatus = updates.status ?? existing.status;
  const nextHoldReason = String(updates.holdReason ?? existing.holdReason ?? "").trim().slice(0, 500);
  const nextHoldRemindAt = updates.holdRemindAt === undefined ? existing.holdRemindAt : updates.holdRemindAt;
  const assignedChanged = updates.assignedTo !== undefined && Number(updates.assignedTo || 0) !== Number(existing.assignedTo || 0);
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
      if (updates.assignedTo && !String(updates.diagnosis ?? existing.diagnosis).trim()) {
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
    if (nextStatus !== "on_hold" && !diagnosisText && (assignedChanged || !existing.diagnosisDueAt || previousDiagnosis) && (updates.assignedTo !== undefined ? updates.assignedTo : existing.assignedTo) && !["collected", "cancelled", "on_hold"].includes(nextStatus)) {
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
    if (!assignedChanged && !String(updates.diagnosis ?? existing.diagnosis).trim() && existing.assignedTo) {
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
  if (updates.softwareLicense !== undefined) {
    fields.push(`software_license = $${idx}`);
    params.push(updates.softwareLicense ? 1 : 0);
    idx++;
  }

  if (!fields.length) return await loadTicketDetails(ticketId);

  const pCost = await queryOne("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = $1", [ticketId]) as { c: number };
  const partsCost = pCost?.c || 0;
  const repairType = updates.repairType !== undefined ? updates.repairType : existing.repairType;
  const hwValue = updates.hardwareValue !== undefined ? updates.hardwareValue : existing.hardwareValue;
  const swInstall = updates.softwareInstall !== undefined ? updates.softwareInstall : existing.softwareInstall;
  const swLicense = updates.softwareLicense !== undefined ? updates.softwareLicense : existing.softwareLicense;
  const totalCost = await calculateRepairCost(repairType, hwValue, partsCost, swInstall, swLicense);
  const laborCost = totalCost - partsCost;

  fields.push(`labor_cost = $${idx}`);
  params.push(laborCost);
  idx++;
  fields.push(`parts_cost = $${idx}`);
  params.push(partsCost);
  idx++;
  fields.push(`total_cost = $${idx}`);
  params.push(totalCost);
  idx++;
  fields.push("updated_at = NOW()::text");

  params.push(ticketId);
  await query(`UPDATE repair_tickets SET ${fields.join(", ")} WHERE id = $${idx}`, params);

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
  if (Math.abs(Number(existing.totalCost || 0) - Number(totalCost || 0)) >= 0.01) {
    await addRepairUpdate(ticketId, staffId || null, "quote_updated", `Repair estimate changed from ${Number(existing.totalCost || 0).toFixed(2)} to ${Number(totalCost || 0).toFixed(2)}.`, false);
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

export async function runRepairWorkflowSweep(): Promise<{ diagnosisEscalated: any[]; holdReminders: any[] }> {
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
  return { diagnosisEscalated, holdReminders };
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
  const part = await queryOne("SELECT description, product_id, quantity, unit_cost FROM repair_parts_used WHERE id = $1 AND ticket_id = $2", [partId, ticketId]) as any;
  const r = await query("DELETE FROM repair_parts_used WHERE id = $1 AND ticket_id = $2", [partId, ticketId]);
  if ((r.rowCount ?? 0) > 0) {
    await recalculateTicketCost(ticketId);
    await addRepairUpdate(ticketId, staffId || null, "part_removed", `Part removed: ${part?.description || "part"} × ${Number(part?.quantity) || 1}.`, false);
    if (part?.product_id) {
      const qty = Number(part.quantity) || 1;
      try {
        await transaction(async (client) => {
          await client.query("UPDATE products SET stock_on_hand = stock_on_hand + $1 WHERE id = $2", [qty, part.product_id]);
          await client.query("UPDATE stock_levels SET quantity_in_stock = quantity_in_stock + $1, updated_at = NOW()::text WHERE product_id = $2 AND branch_id IS NULL", [qty, part.product_id]);
          await client.query(
            "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes) VALUES ($1, 'restock', $2, 'repair', $3, $4)",
            [part.product_id, qty, ticketId, `Repair part removed #${ticketId}`]
          );
        });
      } catch (e: any) {
        console.warn("[repairs] Failed to restore part stock:", e?.message);
      }
    }
  }
  return (r.rowCount ?? 0) > 0;
}

async function recalculateTicketCost(ticketId: string): Promise<void> {
  const ticket = await loadTicketDetails(ticketId);
  if (!ticket) return;
  const pCost = await queryOne("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = $1", [ticketId]) as { c: number };
  const partsCost = pCost?.c || 0;
  const totalCost = await calculateRepairCost(ticket.repairType, ticket.hardwareValue, partsCost, ticket.softwareInstall, ticket.softwareLicense);
  const laborCost = totalCost - partsCost;
  await query("UPDATE repair_tickets SET labor_cost = $1, parts_cost = $2, total_cost = $3, updated_at = NOW()::text WHERE id = $4", [laborCost, partsCost, totalCost, ticketId]);
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

async function sendRepairQuote(ticketId: string): Promise<boolean> {
  const ticket = await loadTicketDetails(ticketId);
  if (!ticket) return false;
  await query(`UPDATE repair_tickets SET quote_sent_at = NOW()::text, updated_at = NOW()::text WHERE id = $1`, [ticketId]);
  await addRepairUpdate(ticketId, null, "quote_sent", "A cost estimate has been sent. Please review and respond.", true);
  return true;
}

async function respondToRepairQuote(ticketId: string, response: "accepted" | "declined"): Promise<boolean> {
  const ticket = await loadTicketDetails(ticketId);
  if (!ticket || !ticket.quoteSentAt) return false;
  await query(`UPDATE repair_tickets SET quote_response = $1, quote_responded_at = NOW()::text, updated_at = NOW()::text WHERE id = $2`, [response, ticketId]);
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
  sendRepairQuote,
  respondToRepairQuote,
};
