import { Router, Request, Response } from "express";
import { query, queryOne, queryAll } from "./db-helpers";
import { staffAuthMiddleware } from "./auth";
import { asyncHandler } from "./routes/shared";
import { getSettings } from "./db";
import { notify } from "./notification-service";
import { warrantyClaimAdminEmail, warrantyStatusAdminEmail } from "./email";

const router = Router();

const DASH_URL = () => `${(process.env.FRONTEND_URL || process.env.BASE_URL || "").replace(/\/$/, "")}/admin`;

router.post("/", staffAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { warrantyRef, customerId, serialNumber, repairTicketId, notes } = req.body || {};
  if (!warrantyRef || !String(warrantyRef).trim()) {
    res.status(400).json({ error: "warranty_ref is required." });
    return;
  }
  const result = await query(
    `INSERT INTO warranty_claims (warranty_ref, customer_id, serial_number, repair_ticket_id, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      String(warrantyRef).trim(),
      customerId != null && !Number.isNaN(Number(customerId)) ? Number(customerId) : null,
      serialNumber ? String(serialNumber) : null,
      repairTicketId != null && !Number.isNaN(Number(repairTicketId)) ? Number(repairTicketId) : null,
      notes ? String(notes) : ""
    ]
  );
  const claim = result.rows[0];
  if (claim) {
    try {
      const settings = await getSettings();
      const storeName = settings.storeName || "My Shop";
      const cRow = await queryOne("SELECT name FROM customers WHERE id = $1", [claim.customer_id]);
      const customerName = claim.customer_id != null && cRow?.name ? String(cRow.name) : "Customer";
      const { subject, html } = warrantyClaimAdminEmail(
        claim.id,
        claim.warranty_ref,
        customerName,
        claim.serial_number || "",
        claim.notes || "",
        DASH_URL(),
        storeName
      );
      await notify({
        event: "warranty.created",
        entityType: "warranty",
        entityId: claim.id,
        subject,
        bodyText: `New warranty claim #${claim.id} (${claim.warranty_ref}) from ${customerName}. Open Admin > Warranties to review.`,
        bodyHtml: html,
      });
    } catch (_err: any) { console.warn("[warranty] notification failed:", _err?.message || _err); }
  }
  res.status(201).json(claim);
}));

router.get("/", staffAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const rawCustomer = req.query.customerId;
  if (rawCustomer != null && Number.isNaN(Number(rawCustomer))) {
    res.status(400).json({ error: "Invalid customerId." });
    return;
  }
  const customerId = rawCustomer != null ? Number(rawCustomer) : null;
  const rows = customerId != null
    ? await queryAll("SELECT * FROM warranty_claims WHERE customer_id = $1 ORDER BY claim_date DESC", [customerId])
    : await queryAll("SELECT * FROM warranty_claims ORDER BY claim_date DESC");
  res.json({ claims: rows });
}));

router.get("/:id", staffAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) { res.status(400).json({ error: "Invalid claim id." }); return; }
  const row = await queryOne("SELECT * FROM warranty_claims WHERE id = $1", [id]);
  if (!row) { res.status(404).json({ error: "Warranty claim not found." }); return; }
  res.json(row);
}));

router.put("/:id/status", staffAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) { res.status(400).json({ error: "Invalid claim id." }); return; }
  const { status, notes, approvedBy } = req.body || {};
  const allowed = ["submitted", "approved", "rejected", "resolved"];
  const newStatus = String(status || "").trim();
  if (!allowed.includes(newStatus)) { res.status(400).json({ error: "Invalid status." }); return; }
  const oldClaim = await queryOne("SELECT * FROM warranty_claims WHERE id = $1", [id]);
  const result = await query(
    `UPDATE warranty_claims
     SET status = $1,
         notes = CASE WHEN $2 = '' THEN notes ELSE $2 END,
         resolution_date = CASE WHEN $1 IN ('approved', 'rejected', 'resolved') THEN COALESCE(resolution_date, NOW()::text) ELSE resolution_date END,
         approved_by = COALESCE($3, approved_by)
     WHERE id = $4
     RETURNING *`,
    [newStatus, notes ? String(notes) : "", approvedBy != null && !Number.isNaN(Number(approvedBy)) ? Number(approvedBy) : null, id]
  );
  if (!result.rows[0]) { res.status(404).json({ error: "Warranty claim not found." }); return; }
  const claim = result.rows[0];
  if (oldClaim && oldClaim.status !== newStatus) {
    try {
      const settings = await getSettings();
      const storeName = settings.storeName || "My Shop";
      const cRow = await queryOne("SELECT name FROM customers WHERE id = $1", [claim.customer_id]);
      const customerName = claim.customer_id != null && cRow?.name ? String(cRow.name) : "Customer";
      const { subject, html } = warrantyStatusAdminEmail(
        claim.id,
        claim.warranty_ref,
        customerName,
        String(oldClaim.status),
        newStatus,
        DASH_URL(),
        storeName
      );
      await notify({
        event: newStatus === "approved" ? "warranty.approved" : newStatus === "rejected" ? "warranty.rejected" : newStatus === "resolved" ? "warranty.resolved" : "warranty.status_changed",
        entityType: "warranty",
        entityId: claim.id,
        subject,
        bodyText: `Warranty claim #${claim.id} (${claim.warranty_ref}) status changed to ${newStatus}.`,
        bodyHtml: html,
      });
    } catch (_err: any) { console.warn("[warranty] notification failed:", _err?.message || _err); }
  }
  res.json(result.rows[0]);
}));

export default router;
