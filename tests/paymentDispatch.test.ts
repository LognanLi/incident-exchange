// Real x402 client + fetch transport, synthetic signer and network. No wallets or network calls.
import { describe, expect, it } from "vitest";
import { x402Client } from "@x402/core/client";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { wrapFetchWithPayment } from "@x402/fetch";
import { trackPaymentDispatch } from "../convex/lib/paymentDispatch";

const PAYEE = "0x22204BeDAdC581473c5472B2F797f30902d85527";
const required = {
  x402Version: 2, resource: { url: "https://fixture.invalid/paid", description: "authorized fixture", mimeType: "application/json" },
  accepts: [{ scheme: "exact", network: "eip155:84532" as const, amount: "10000", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", payTo: PAYEE, maxTimeoutSeconds: 300, extra: { name: "USDC", version: "2" } }],
};

describe("x402 dispatch tracking", () => {
  for (const outcome of ["persisted", "closed", "unavailable"] as const) {
    it(`${outcome}: a signed request cannot leave before authorization tracking commits`, async () => {
      const order: string[] = [];
      const client = new x402Client();
      client.setSpendControls({ allowedAssets: [{ asset: required.accepts[0].asset, network: "eip155:84532", maxAmountPerPayment: "10000" }] });
      client.register("eip155:84532", {
        scheme: "exact",
        createPaymentPayload: async () => ({ x402Version: 2, payload: { authorization: { from: PAYEE, nonce: "fixture-nonce" }, signature: "synthetic-signature" } }),
      });
      client.onAfterPaymentCreation(trackPaymentDispatch(async (payer, nonce) => {
        expect([payer, nonce]).toEqual([PAYEE, "fixture-nonce"]);
        if (outcome === "unavailable") throw new Error("tracking unavailable");
        if (outcome === "closed") return { ok: false };
        order.push("persisted");
        return { ok: true };
      }));
      const fakeFetch = async (input: RequestInfo | URL) => {
        const req = input as Request;
        if (!req.headers.has("PAYMENT-SIGNATURE")) return new Response(null, { status: 402, headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(required) } });
        order.push("dispatched");
        // A lost response after dispatch must leave the stored nonce intact for reconciliation.
        throw new Error("network timeout after dispatch");
      };
      await expect(wrapFetchWithPayment(fakeFetch as typeof fetch, client)(required.resource.url, { method: "POST" })).rejects.toThrow(outcome === "persisted" ? /network timeout after dispatch/ : outcome === "closed" ? /earlier payment is pending/ : /tracking unavailable/);
      expect(order).toEqual(outcome === "persisted" ? ["persisted", "dispatched"] : []);
    });
  }
});
