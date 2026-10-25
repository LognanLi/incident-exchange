// invoice-api: invoice service.
// `caller` is the authenticated principal resolved by the API gateway: { userId, tenantId }.
// `invoiceId` comes straight from the client (URL path).

/**
 * @typedef {{ id: string, tenantId: string, customer: string, amountCents: number, status: "open" | "paid" | "void" }} Invoice
 * @typedef {{ findInvoiceById(id: string): Promise<Invoice | null>, updateInvoiceStatus(id: string, status: Invoice["status"]): Promise<void> }} InvoiceDb
 */

/** @param {InvoiceDb} db */
export function createInvoiceService(db) {
  return {
    async getInvoice(caller, invoiceId) {
      const invoice = await db.findInvoiceById(invoiceId);
      if (!invoice) return { ok: false, error: "not_found" };
      return { ok: true, invoice };
    },

    async voidInvoice(caller, invoiceId) {
      const invoice = await db.findInvoiceById(invoiceId);
      if (!invoice) return { ok: false, error: "not_found" };
      await db.updateInvoiceStatus(invoice.id, "void");
      return { ok: true, invoice: { ...invoice, status: "void" } };
    },
  };
}
