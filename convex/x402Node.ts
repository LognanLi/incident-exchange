"use node";
// Coinbase x402 on Base Sepolia with CDP Server Wallets. Testnet only — no real funds.
// Secrets (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET) are read from the Convex
// deployment environment by the CDP SDK; they never reach the browser.
import { ConvexError, v } from "convex/values";
import { CdpClient } from "@coinbase/cdp-sdk";
import { applySpendControls, createCdpFacilitatorClient, fromCdpEvmAccount } from "@coinbase/cdp-sdk/x402";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer, type HTTPAdapter } from "@x402/core/server";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { baseSepolia } from "viem/chains";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  BUYER_WALLET_NAME,
  CDP_NETWORK,
  MAX_ATOMIC_PER_PAYMENT,
  RECEIVER_WALLET_NAME,
  USDC_BASE_SEPOLIA,
  X402_NETWORK,
  cdpCredentialsPresent,
  atomicToMoney,
} from "./lib/x402";

function requireCdp() {
  if (!cdpCredentialsPresent()) {
    throw new ConvexError("CDP credentials are not set on the Convex deployment (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET).");
  }
}

async function usdcBalance(address: `0x${string}`): Promise<string> {
  const client = createPublicClient({ chain: baseSepolia, transport: http() });
  const raw = await client.readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  return formatUnits(raw, 6);
}

/**
 * Wallet setup: get-or-create the CDP buyer and receiver accounts on Base Sepolia, store their
 * addresses, and top up the buyer with faucet test USDC when it holds less than 1 USDC.
 * Run with `npm run x402:setup`.
 */
export const setup = internalAction({
  args: { fund: v.optional(v.boolean()) },
  handler: async (ctx, { fund }) => {
    requireCdp();
    const cdp = new CdpClient();
    const buyer = await cdp.evm.getOrCreateAccount({ name: BUYER_WALLET_NAME });
    const receiver = await cdp.evm.getOrCreateAccount({ name: RECEIVER_WALLET_NAME });
    await ctx.runMutation(internal.x402State.saveWallet, { role: "buyer", accountName: BUYER_WALLET_NAME, address: buyer.address, network: CDP_NETWORK });
    await ctx.runMutation(internal.x402State.saveWallet, { role: "receiver", accountName: RECEIVER_WALLET_NAME, address: receiver.address, network: CDP_NETWORK });

    let balance = await usdcBalance(buyer.address);
    let faucetTx: string | undefined;
    if (fund !== false && Number(balance) < 1) {
      const res = await cdp.evm.requestFaucet({ address: buyer.address, network: CDP_NETWORK, token: "usdc" });
      faucetTx = res.transactionHash;
      const client = createPublicClient({ chain: baseSepolia, transport: http() });
      await client.waitForTransactionReceipt({ hash: faucetTx as `0x${string}`, timeout: 90_000 }).catch(() => undefined);
      balance = await usdcBalance(buyer.address);
    }
    await ctx.runMutation(internal.x402State.recordSetup, { message: `x402 wallets ready on Base Sepolia; buyer holds ${balance} test USDC.` });
    return {
      network: CDP_NETWORK,
      buyer: { name: BUYER_WALLET_NAME, address: buyer.address, usdc: balance },
      receiver: { name: RECEIVER_WALLET_NAME, address: receiver.address, usdc: await usdcBalance(receiver.address) },
      faucetTx,
    };
  },
});

type SellerResponse = { status: number; headers: Record<string, string>; body: unknown };

/**
 * Seller side of the x402 HTTP flow for POST /x402/purchases/<purchaseId>.
 * No payment header → 402 with payment requirements. Valid payment → verify + settle through the
 * facilitator, then mark the purchase paid. Price and payee come from the stored purchase only.
 */
export const sellerHandle = internalAction({
  args: { method: v.string(), url: v.string(), path: v.string(), headers: v.record(v.string(), v.string()) },
  handler: async (ctx, { method, url, path, headers }): Promise<SellerResponse> => {
    const purchaseId = path.split("/").filter(Boolean).pop() ?? "";
    const purchase = await ctx.runQuery(internal.x402State.purchaseForSeller, { purchaseId });
    if (!purchase) return { status: 404, headers: {}, body: { error: "No pending x402 purchase at this URL." } };

    try {
      const facilitator = process.env.X402_FACILITATOR_URL
        ? new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL })
        : createCdpFacilitatorClient();
      const resourceServer = new x402ResourceServer(facilitator).register(X402_NETWORK, new ExactEvmScheme());
      const httpServer = new x402HTTPResourceServer(resourceServer, {
        [`POST ${path}`]: {
          accepts: {
            scheme: "exact",
            price: atomicToMoney(purchase.x402.atomicAmount),
            network: X402_NETWORK,
            payTo: purchase.x402.payTo,
            maxTimeoutSeconds: 300,
          },
          description: `Unlock “${purchase.playbookTitle}” (Incident Exchange test purchase)`,
          mimeType: "application/json",
        },
      });
      await httpServer.initialize();

      const lower = Object.fromEntries(Object.entries(headers).map(([k, val]) => [k.toLowerCase(), val]));
      const adapter: HTTPAdapter = {
        getHeader: (name) => lower[name.toLowerCase()],
        getMethod: () => method,
        getPath: () => path,
        getUrl: () => url,
        getAcceptHeader: () => lower["accept"] ?? "application/json",
        getUserAgent: () => lower["user-agent"] ?? "",
      };
      const context = { adapter, path, method, paymentHeader: lower["payment-signature"] ?? lower["x-payment"] };
      const result = await httpServer.processHTTPRequest(context);

      if (result.type === "no-payment-required") return { status: 500, headers: {}, body: { error: "Route unexpectedly free." } };
      if (result.type === "payment-error") return { status: result.response.status, headers: result.response.headers, body: result.response.body ?? {} };

      if (result.paymentRequirements.amount !== purchase.x402.atomicAmount) {
        return { status: 402, headers: {}, body: { error: "Payment amount does not match this purchase." } };
      }
      const settle = await httpServer.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, {
        request: context,
      });
      if (!settle.success) {
        await ctx.runMutation(internal.x402State.recordFailure, { purchaseId: purchase._id, message: `Settlement failed: ${settle.errorReason ?? "unknown"}` });
        return { status: settle.response.status, headers: settle.response.headers, body: settle.response.body ?? {} };
      }
      await ctx.runMutation(internal.x402State.recordSuccess, {
        purchaseId: purchase._id,
        payer: settle.payer,
        txHash: settle.transaction,
        network: settle.network,
      });
      return { status: 200, headers: settle.headers, body: { ok: true, txHash: settle.transaction, network: settle.network } };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 240) : "unknown error";
      await ctx.runMutation(internal.x402State.recordFailure, { purchaseId: purchase._id, message: `x402 seller error: ${message}` });
      return { status: 502, headers: {}, body: { error: message } };
    }
  },
});

/**
 * Buyer side: the backend-managed CDP buyer wallet pays the purchase's x402 endpoint.
 * Spend controls cap each payment at 1 test USDC, Base Sepolia USDC only, to our receiver only.
 */
export const payWithX402 = action({
  args: { actor: v.string(), purchaseId: v.id("purchases") },
  handler: async (ctx, { actor, purchaseId }): Promise<{ txHash?: string }> => {
    requireCdp();
    const purchase = await ctx.runQuery(internal.x402State.purchaseForBuyer, { actor, purchaseId });
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) throw new ConvexError("CONVEX_SITE_URL is not available.");

    try {
      const cdp = new CdpClient();
      const account = await cdp.evm.getOrCreateAccount({ name: BUYER_WALLET_NAME });
      const client = new x402Client();
      registerExactEvmScheme(client, { signer: fromCdpEvmAccount(account) });
      applySpendControls(client, {
        maxAmountPerPayment: { atomic: MAX_ATOMIC_PER_PAYMENT, asset: USDC_BASE_SEPOLIA },
        allowedNetworks: [X402_NETWORK],
        allowedAssets: [USDC_BASE_SEPOLIA],
        allowedPayees: [purchase.x402.payTo as `0x${string}`],
      });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const res = await fetchWithPayment(`${siteUrl}/x402/purchases/${purchaseId}`, { method: "POST", headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; txHash?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Payment endpoint responded ${res.status}`);
      return { txHash: body.txHash };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 240) : "unknown error";
      await ctx.runMutation(internal.x402State.recordFailure, { purchaseId, message: `x402 payment failed: ${message}` });
      throw new ConvexError(`x402 payment failed: ${message}`);
    }
  },
});
