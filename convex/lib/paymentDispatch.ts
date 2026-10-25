import type { PaymentCreatedContext } from "@x402/core/client";

// Persist public authorization identifiers before the transport can send a signed request. A timeout
// before the seller receives it must still reserve the budget and prevent a second authorization.
export function trackPaymentDispatch(persist: (payer: string, nonce: string) => Promise<{ ok: boolean }>) {
  return async ({ paymentPayload }: PaymentCreatedContext) => {
    const auth = (paymentPayload.payload as { authorization?: { from?: string; nonce?: string } }).authorization;
    if (!auth?.from || !auth.nonce) throw new Error("Missing payment authorization identifiers; no request sent.");
    if (!(await persist(auth.from, auth.nonce)).ok) throw new Error("An earlier payment is pending or this checkout is closed; no request sent.");
  };
}
