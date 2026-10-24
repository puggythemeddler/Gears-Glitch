export interface RenewalInvoiceCandidate {
  id: number;
  plan: string;
  nextPaymentDate: string;
  periodType: "monthly" | "annual";
  monthlyPrice: number;
  annualPrice: number | null;
}

export interface RenewalInvoicePayload {
  providerId: number;
  planId: string;
  periodType: "monthly" | "annual";
  periodStart: string;
  dueDate: string;
  generationKey: string;
}

export interface ExistingInvoice {
  id: number;
  invoiceNumber?: string;
  status: string;
  createdAt?: string;
}

export interface GeneratedInvoice {
  id: number;
  invoiceNumber?: string;
  created: boolean;
  status?: string;
  createdAt?: string;
}

export function isRenewalDateInWindow(dueDate: string, now = new Date(), windowDays = 7): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  const parsed = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) return false;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const latest = new Date(today);
  latest.setUTCDate(latest.getUTCDate() + windowDays);
  return parsed >= today && parsed <= latest;
}

export function renewalGenerationKey(clientId: number, dueDate: string): string {
  return `cp-renewal-client-${clientId}-due-${dueDate}`;
}

export async function processRenewalInvoiceCandidate(
  candidate: RenewalInvoiceCandidate,
  dependencies: {
    listInvoices: () => Promise<ExistingInvoice[]>;
    generateInvoice: (payload: RenewalInvoicePayload) => Promise<GeneratedInvoice>;
  },
  now = new Date()
): Promise<{ status: "outside_window" | "not_billable" | "open_invoice" | "generated" | "existing"; invoice?: GeneratedInvoice | ExistingInvoice }> {
  const dueDate = candidate.nextPaymentDate.slice(0, 10);
  if (!isRenewalDateInWindow(dueDate, now)) return { status: "outside_window" };
  const amount = candidate.periodType === "annual" ? candidate.annualPrice : candidate.monthlyPrice;
  if (!Number.isFinite(amount) || Number(amount) <= 0) return { status: "not_billable" };

  const openInvoice = (await dependencies.listInvoices()).find(invoice =>
    invoice.status.toLowerCase() === "pending" || invoice.status.toLowerCase() === "overdue"
  );
  if (openInvoice) return { status: "open_invoice", invoice: openInvoice };

  const invoice = await dependencies.generateInvoice({
    providerId: 1,
    planId: candidate.plan,
    periodType: candidate.periodType,
    periodStart: dueDate,
    dueDate,
    generationKey: renewalGenerationKey(candidate.id, dueDate),
  });
  return { status: invoice.created ? "generated" : "existing", invoice };
}
