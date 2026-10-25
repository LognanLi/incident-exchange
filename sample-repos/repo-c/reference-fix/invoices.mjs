// invoice-api: invoice service (reference fix).
// Every by-id access loads the invoice, then checks it belongs to the caller's authenticated tenant.
// Another tenant's invoice is answered exactly like a missing one, so callers cannot probe which ids exist.

/**
 * @typedef {{ id: string, tenantId: string, customer: string, amountCents: number, status: "open" | "paid" | "void" }} Invoice
 * @typedef {{ findInvoiceById(id: string): Promise<Invoice | null>, updateInvoiceStatus(id: string, status: Invoice["status"]): Promise<void> }} InvoiceDb
 */

/** @param {InvoiceDb} db */
export function createInvoiceService(db) {
  async function loadOwned(caller, invoiceId) {
    if (!caller || typeof caller.tenantId !== "string" || !caller.tenantId) return null;
    if (typeof invoiceId !== "string" || !invoiceId) return null;
    const invoice = await db.findInvoiceById(invoiceId);
    if (!invoice || invoice.tenantId !== caller.tenantId) return null;
    return invoice;
  }

  return {
    async getInvoice(caller, invoiceId) {
      const invoice = await loadOwned(caller, invoiceId);
      if (!invoice) return { ok: false, error: "not_found" };
      return { ok: true, invoice };
    },

    async voidInvoice(caller, invoiceId) {
      const invoice = await loadOwned(caller, invoiceId);
      if (!invoice) return { ok: false, error: "not_found" };
      await db.updateInvoiceStatus(invoice.id, "void");
      return { ok: true, invoice: { ...invoice, status: "void" } };
    },
  };
}
