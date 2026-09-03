import { query, queryOne, queryAll, transaction } from "./db-helpers";

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
  device_model: string;
  issue_description: string;
  status: string;
  assigned_to: number | null;
  assigned_name?: string | null;
  eta_at: string;
  scheduled_at: string | null;
  diagnosis: string;
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
  deviceModel: string;
  issueDescription: string;
  status: string;
  statusLabel: string;
  assignedTo: number | null;
  assignedName: string | null;
  etaAt: string;
  scheduledAt: string | null;
  diagnosis: string;
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
  assignedTo?: number | null;
  etaAt?: string | null;
  scheduledAt?: string | null;
  diagnosis?: string;
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
  "in_progress", "quality_check", "ready", "unrepairable", "collected", "cancelled", "rejected",
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
};

function isValidStatus(status: string): boolean {
  return STATUSES.includes(status);
}

// Enforced repair lifecycle: a ticket may only move through these transitions,
// so statuses like received->collected or bypassing diagnostic/approval/QC are
// rejected server-side. A ticket may always stay on its current status (idempotent
// saves), and 'cancelled'/'collected' are terminal once reached.
const VALID_TRANSITIONS: { [from: string]: string[] } = {
  received: ["received", "diagnosing", "awaiting_approval", "cancelled"],
  diagnosing: ["diagnosing", "waiting_parts", "awaiting_approval", "in_progress", "quality_check", "ready", "rejected", "unrepairable", "cancelled"],
  waiting_parts: ["waiting_parts", "diagnosing", "awaiting_approval", "approved", "in_progress", "cancelled"],
  awaiting_approval: ["awaiting_approval", "approved", "rejected", "diagnosing", "in_progress", "waiting_parts", "cancelled"],
  approved: ["approved", "in_progress", "waiting_parts", "diagnosing", "quality_check", "ready", "unrepairable", "cancelled"],
  in_progress: ["in_progress", "quality_check", "waiting_parts", "awaiting_approval", "approved", "ready", "cancelled"],
  quality_check: ["quality_check", "in_progress", "ready", "unrepairable", "cancelled"],
  ready: ["ready", "quality_check", "collected", "unrepairable", "cancelled"],
  unrepairable: ["unrepairable", "collected", "cancelled"],
  collected: ["collected"],
  cancelled: ["cancelled"],
  rejected: ["rejected", "collected", "diagnosing", "cancelled"],
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
  if (softwareInstall && !softwareLicense) total += 800;
  if (softwareLicense) total += 2500;
  return total;
}

async function mapTicket(row: TicketRow, extras: any = {}): Promise<Ticket> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: extras.customerName || row.customer_name || "",
    customerEmail: extras.customerEmail || row.customer_email || "",
    deviceType: row.device_type,
    deviceModel: row.device_model || "",
    issueDescription: row.issue_description,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    assignedTo: row.assigned_to,
    assignedName: extras.assignedName || row.assigned_name || null,
    etaAt: row.eta_at,
    scheduledAt: row.scheduled_at,
    diagnosis: row.diagnosis || "",
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
  const issueDescription = String(data.issueDescription || "").trim();

  if (!deviceType || !issueDescription) {
    return { ok: false, error: "Device type and problem description are required." };
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

  await query(
    `INSERT INTO repair_tickets (id, customer_id, device_type, device_model, issue_description, repair_type, status, eta_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'received', (NOW() + interval '48 hours')::text, NOW()::text, NOW()::text)`,
    [id, customerId, deviceType, String(data.deviceModel || "").trim(), fullDescription, repairType]
  );

  await recalculateTicketCost(id);

  await addRepairUpdate(id, null, "status", "Ticket created. Estimated completion within 48 hours.", true);

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
  if (updates.assignedTo !== undefined) {
    fields.push(`assigned_to = $${idx}`);
    params.push(updates.assignedTo || null);
    idx++;
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

  return await loadTicketDetails(ticketId);
}

async function addRepairUpdate(ticketId: string, staffId: number | null, updateType: string, message: string, customerVisible: boolean = false): Promise<void> {
  await query(
    `INSERT INTO repair_updates (ticket_id, staff_id, update_type, message, customer_visible)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, staffId, updateType, message, customerVisible ? 1 : 0]
  );
}

async function addRepairPart(ticketId: string, data: any): Promise<TicketResult> {
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
  return { ok: true, part: mapPart(partRow) };
}

async function removeRepairPart(ticketId: string, partId: number): Promise<boolean> {
  const part = await queryOne("SELECT product_id, quantity FROM repair_parts_used WHERE id = $1 AND ticket_id = $2", [partId, ticketId]) as any;
  const r = await query("DELETE FROM repair_parts_used WHERE id = $1 AND ticket_id = $2", [partId, ticketId]);
  if ((r.rowCount ?? 0) > 0) {
    await recalculateTicketCost(ticketId);
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
