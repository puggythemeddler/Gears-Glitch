import { getDb } from "./db";

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
  "received", "diagnosing", "waiting_parts",
  "in_progress", "ready", "collected", "cancelled",
];

const STATUS_LABELS: { [key: string]: string } = {
  received: "Received",
  diagnosing: "Diagnosing",
  waiting_parts: "Waiting for parts",
  in_progress: "In progress",
  ready: "Ready for collection",
  collected: "Collected",
  cancelled: "Cancelled",
};

function isValidStatus(status: string): boolean {
  return STATUSES.includes(status);
}

function generateTicketId(): string {
  const year = new Date().getFullYear();
  const prefix = `REP-${year}-`;
  const row = getDb()
    .prepare("SELECT id FROM repair_tickets WHERE id LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`${prefix}%`) as { id: string } | undefined;
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

function getRepairTypeName(typeId: string | null): string {
  if (!typeId) return "";
  const row = getDb().prepare("SELECT name FROM repair_types WHERE id = ?").get(typeId) as { name: string } | undefined;
  return row?.name || "";
}

function calculateRepairCost(typeId: string | null, hardwareValue: number, partsCost: number, softwareInstall: boolean, softwareLicense: boolean): number {
  let total = 0;
  if (typeId) {
    const rt = getDb().prepare("SELECT base_price FROM repair_types WHERE id = ?").get(typeId) as { basePrice?: number } | undefined;
    if (rt?.basePrice) total += rt.basePrice;
    // Hardware-based pricing: labor scales with hardware value (5% of hardware value for high-end devices)
    if (hardwareValue > 0) {
      total += Math.round(hardwareValue * 0.05);
    }
  }
  total += partsCost;
  if (softwareInstall && !softwareLicense) total += 800;
  if (softwareLicense) total += 2500;
  return total;
}

function mapTicket(row: TicketRow, extras: any = {}): Ticket {
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
    repairTypeName: getRepairTypeName(row.repair_type),
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

function loadTicketDetails(ticketId: string): Ticket | null {
  const row = getDb()
    .prepare(
      `SELECT t.*, c.name AS customer_name, c.email AS customer_email,
              u.username AS assigned_name
       FROM repair_tickets t
       JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = ?`
    )
    .get(ticketId) as TicketRow | undefined;

  if (!row) return null;

  const parts: Part[] = getDb()
    .prepare("SELECT * FROM repair_parts_used WHERE ticket_id = ? ORDER BY id")
    .all(ticketId)
    .map((r: any) => mapPart(r));

  const updates: RepairUpdate[] = getDb()
    .prepare(
      `SELECT ru.*, u.username AS staff_name
       FROM repair_updates ru
       LEFT JOIN users u ON u.id = ru.staff_id
       WHERE ru.ticket_id = ?
       ORDER BY ru.created_at ASC`
    )
    .all(ticketId)
    .map((u: any) => mapUpdate(u, u.staff_name));

  return mapTicket(row, { parts, updates });
}

function createRepairTicket(customerId: number, data: any): TicketResult {
  const id = generateTicketId();
  const deviceType = String(data.deviceType || "").trim();
  const issueDescription = String(data.issueDescription || "").trim();

  if (!deviceType || !issueDescription) {
    return { ok: false, error: "Device type and problem description are required." };
  }

  getDb()
    .prepare(
      `INSERT INTO repair_tickets (
        id, customer_id, device_type, device_model, issue_description,
        status, eta_at, created_at, updated_at
      ) VALUES (
        @id, @customer_id, @device_type, @device_model, @issue_description,
        'received', datetime('now', '+48 hours'), datetime('now'), datetime('now')
      )`
    )
    .run({
      id,
      customer_id: customerId,
      device_type: deviceType,
      device_model: String(data.deviceModel || "").trim(),
      issue_description: issueDescription,
    });

  addRepairUpdate(id, null, "status", "Ticket created. Estimated completion within 48 hours.", true);

  return { ok: true, ticket: loadTicketDetails(id)! };
}

function listRepairsForCustomer(customerId: number): Ticket[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, c.name AS customer_name, c.email AS customer_email,
              u.username AS assigned_name
       FROM repair_tickets t
       JOIN customers c ON c.id = t.customer_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.customer_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(customerId) as TicketRow[];

  return rows.map((row) => {
    const ticket = mapTicket(row);
    const updates = getDb()
      .prepare(
        `SELECT ru.*, u.username AS staff_name
         FROM repair_updates ru
         LEFT JOIN users u ON u.id = ru.staff_id
         WHERE ru.ticket_id = ? AND ru.customer_visible = 1
         ORDER BY ru.created_at ASC`
      )
      .all(ticket.id)
      .map((u: any) => mapUpdate(u, u.staff_name));
    ticket.updates = updates;
    return ticket;
  });
}

function listRepairsForCustomerPaged(customerId: number, options: CustomerPagedFilter = {}): PagedResult {
  const { status, page = 1, pageSize = 10 } = options;
  const whereClauses: string[] = ["t.customer_id = ?"];
  const params: any[] = [customerId];
  if (status) {
    whereClauses.push("t.status = ?");
    params.push(status);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRow = getDb()
    .prepare(`SELECT COUNT(*) AS cnt FROM repair_tickets t ${where}`)
    .get(...params) as { cnt: number };
  const total = countRow ? countRow.cnt : 0;

  const offset = (Number(page) - 1) * Number(pageSize);

  const query = `
    SELECT t.*, c.name AS customer_name, c.email AS customer_email,
           u.username AS assigned_name
    FROM repair_tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.assigned_to
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = getDb().prepare(query).all(...params, Number(pageSize), offset) as TicketRow[];

  const tickets = rows.map((row) => {
    const ticket = mapTicket(row);
    const updates = getDb()
      .prepare(
        `SELECT ru.*, u.username AS staff_name
         FROM repair_updates ru
         LEFT JOIN users u ON u.id = ru.staff_id
         WHERE ru.ticket_id = ? AND ru.customer_visible = 1
         ORDER BY ru.created_at ASC`
      )
      .all(ticket.id)
      .map((u: any) => mapUpdate(u, u.staff_name));
    ticket.updates = updates;
    return ticket;
  });

  return { tickets, total, page: Number(page), pageSize: Number(pageSize) };
}

function listRepairsForStaff(options: StaffFilter = {}): Ticket[] {
  const { status, assignedTo } = options;
  let query = `
    SELECT t.*, c.name AS customer_name, c.email AS customer_email,
           u.username AS assigned_name
    FROM repair_tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += " AND t.status = ?";
    params.push(status);
  }
  if (assignedTo) {
    query += " AND t.assigned_to = ?";
    params.push(assignedTo);
  }

  query += " ORDER BY t.created_at DESC";

  return (getDb().prepare(query).all(...params) as TicketRow[]).map((row) => mapTicket(row));
}

function listCalendarRepairs(from: string, to: string, assignedTo?: number): Ticket[] {
  let query = `
    SELECT t.*, c.name AS customer_name, c.email AS customer_email,
           u.username AS assigned_name
    FROM repair_tickets t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.scheduled_at IS NOT NULL
      AND t.scheduled_at >= ?
      AND t.scheduled_at < ?
      AND t.status NOT IN ('collected', 'cancelled')
  `;
  const params: any[] = [from, to];

  if (assignedTo) {
    query += " AND t.assigned_to = ?";
    params.push(assignedTo);
  }

  query += " ORDER BY t.scheduled_at ASC";

  return (getDb().prepare(query).all(...params) as TicketRow[]).map((row) => mapTicket(row));
}

function updateRepairTicket(ticketId: string, updates: TicketUpdates, staffId?: number): Ticket | { error: string } | null {
  const existing = loadTicketDetails(ticketId);
  if (!existing) return null;

  const fields: string[] = [];
  const params: { [key: string]: any } = { id: ticketId };

  if (updates.status !== undefined) {
    if (!isValidStatus(updates.status)) return { error: "Invalid status." };
    fields.push("status = @status");
    params.status = updates.status;
    if (updates.status === "collected") {
      fields.push("completed_at = datetime('now')");
    }
  }
  if (updates.assignedTo !== undefined) {
    fields.push("assigned_to = @assigned_to");
    params.assigned_to = updates.assignedTo || null;
  }
  if (updates.etaAt !== undefined) {
    fields.push("eta_at = @eta_at");
    params.eta_at = updates.etaAt || null;
  }
  if (updates.scheduledAt !== undefined) {
    fields.push("scheduled_at = @scheduled_at");
    params.scheduled_at = updates.scheduledAt || null;
  }
  if (updates.diagnosis !== undefined) {
    fields.push("diagnosis = @diagnosis");
    params.diagnosis = updates.diagnosis;
  }
  if (updates.workNotes !== undefined) {
    fields.push("work_notes = @work_notes");
    params.work_notes = updates.workNotes;
  }
  if (updates.customerNotes !== undefined) {
    fields.push("customer_notes = @customer_notes");
    params.customer_notes = updates.customerNotes;
  }
  if (updates.deviceType !== undefined) {
    fields.push("device_type = @device_type");
    params.device_type = updates.deviceType;
  }
  if (updates.deviceModel !== undefined) {
    fields.push("device_model = @device_model");
    params.device_model = updates.deviceModel;
  }
  if (updates.issueDescription !== undefined) {
    fields.push("issue_description = @issue_description");
    params.issue_description = updates.issueDescription;
  }
  if (updates.repairType !== undefined) {
    fields.push("repair_type = @repair_type");
    params.repair_type = updates.repairType || null;
  }
  if (updates.hardwareValue !== undefined) {
    fields.push("hardware_value = @hardware_value");
    params.hardware_value = updates.hardwareValue;
  }
  if (updates.softwareInstall !== undefined) {
    fields.push("software_install = @software_install");
    params.software_install = updates.softwareInstall ? 1 : 0;
  }
  if (updates.softwareLicense !== undefined) {
    fields.push("software_license = @software_license");
    params.software_license = updates.softwareLicense ? 1 : 0;
  }

  if (!fields.length) return loadTicketDetails(ticketId);

  // Calculate the total cost from parts and pricing fields
  const pCost = getDb().prepare("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = ?").get(ticketId) as { c: number };
  const partsCost = pCost?.c || 0;
  const repairType = updates.repairType !== undefined ? updates.repairType : existing.repairType;
  const hwValue = updates.hardwareValue !== undefined ? updates.hardwareValue : existing.hardwareValue;
  const swInstall = updates.softwareInstall !== undefined ? updates.softwareInstall : existing.softwareInstall;
  const swLicense = updates.softwareLicense !== undefined ? updates.softwareLicense : existing.softwareLicense;
  const totalCost = calculateRepairCost(repairType, hwValue, partsCost, swInstall, swLicense);
  const laborCost = totalCost - partsCost;

  fields.push("labor_cost = @labor_cost");
  params.labor_cost = laborCost;
  fields.push("parts_cost = @parts_cost");
  params.parts_cost = partsCost;
  fields.push("total_cost = @total_cost");
  params.total_cost = totalCost;
  fields.push("updated_at = datetime('now')");

  getDb()
    .prepare(`UPDATE repair_tickets SET ${fields.join(", ")} WHERE id = @id`)
    .run(params);

  if (updates.status && updates.status !== existing.status) {
    addRepairUpdate(
      ticketId,
      staffId || null,
      "status",
      `Status changed to ${STATUS_LABELS[updates.status]}.`,
      true
    );
  }

  return loadTicketDetails(ticketId);
}

function addRepairUpdate(ticketId: string, staffId: number | null, updateType: string, message: string, customerVisible: boolean = false): void {
  getDb()
    .prepare(
      `INSERT INTO repair_updates (ticket_id, staff_id, update_type, message, customer_visible)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ticketId, staffId, updateType, message, customerVisible ? 1 : 0);
}

function addRepairPart(ticketId: string, data: any): TicketResult {
  const desc = String(data.description || "").trim();
  if (!desc) return { ok: false, error: "Part description is required." };

  const qty = Math.max(1, Number(data.quantity) || 1);
  const cost = Number(data.unitCost) || 0;

  const result = getDb()
    .prepare(
      `INSERT INTO repair_parts_used (ticket_id, description, product_id, quantity, unit_cost)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ticketId, desc, data.productId || null, qty, cost);

  // Recalculate costs when parts change
  recalculateTicketCost(ticketId);

  return {
    ok: true,
    part: mapPart(getDb().prepare("SELECT * FROM repair_parts_used WHERE id = ?").get(result.lastInsertRowid) as any),
  };
}

function removeRepairPart(ticketId: string, partId: number): boolean {
  const result = getDb()
    .prepare("DELETE FROM repair_parts_used WHERE id = ? AND ticket_id = ?")
    .run(partId, ticketId);
  if (result.changes > 0) recalculateTicketCost(ticketId);
  return result.changes > 0;
}

function recalculateTicketCost(ticketId: string): void {
  const ticket = loadTicketDetails(ticketId);
  if (!ticket) return;
  const pCost = getDb().prepare("SELECT COALESCE(SUM(quantity * unit_cost), 0) AS c FROM repair_parts_used WHERE ticket_id = ?").get(ticketId) as { c: number };
  const partsCost = pCost?.c || 0;
  const totalCost = calculateRepairCost(ticket.repairType, ticket.hardwareValue, partsCost, ticket.softwareInstall, ticket.softwareLicense);
  const laborCost = totalCost - partsCost;
  getDb().prepare("UPDATE repair_tickets SET labor_cost = ?, parts_cost = ?, total_cost = ?, updated_at = datetime('now') WHERE id = ?").run(laborCost, partsCost, totalCost, ticketId);
}

function getDashboardStats(): DashboardStats {
  const open = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM repair_tickets WHERE status NOT IN ('collected', 'cancelled')`)
    .get() as { c: number };
  const dueToday = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM repair_tickets
       WHERE status NOT IN ('collected', 'cancelled')
       AND date(eta_at) <= date('now')`)
    .get() as { c: number };
  const scheduledToday = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM repair_tickets
       WHERE scheduled_at IS NOT NULL
       AND date(scheduled_at) = date('now')
       AND status NOT IN ('collected', 'cancelled')`)
    .get() as { c: number };
  const unassigned = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM repair_tickets
       WHERE assigned_to IS NULL AND status NOT IN ('collected', 'cancelled')`)
    .get() as { c: number };

  return { openRepairs: open.c, dueToday: dueToday.c, scheduledToday: scheduledToday.c, unassigned: unassigned.c };
}

function listRepairTypes(): RepairType[] {
  return getDb().prepare("SELECT id, name, description, base_price AS basePrice FROM repair_types ORDER BY name").all() as RepairType[];
}

function sendRepairQuote(ticketId: string): boolean {
  const ticket = loadTicketDetails(ticketId);
  if (!ticket) return false;
  getDb()
    .prepare(`UPDATE repair_tickets SET quote_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(ticketId);
  addRepairUpdate(ticketId, null, "quote_sent", "A cost estimate has been sent. Please review and respond.", true);
  return true;
}

function respondToRepairQuote(ticketId: string, response: "accepted" | "declined"): boolean {
  const ticket = loadTicketDetails(ticketId);
  if (!ticket || !ticket.quoteSentAt) return false;
  getDb()
    .prepare(`UPDATE repair_tickets SET quote_response = ?, quote_responded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(response, ticketId);
  addRepairUpdate(ticketId, null, "quote_" + response, `Customer ${response} the cost estimate.`, true);
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
