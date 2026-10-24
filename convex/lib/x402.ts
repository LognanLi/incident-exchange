// Coinbase x402 on Base Sepolia (testnet only). Framework-free helpers shared by Convex functions and the UI.

export const X402_NETWORK = "eip155:84532"; // CAIP-2 id for Base Sepolia
export const CDP_NETWORK = "base-sepolia"; // CDP SDK network name
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BUYER_WALLET_NAME = "ix-demo-buyer-harbor";
export const RECEIVER_WALLET_NAME = "ix-demo-platform-receiver";
/** Hard cap per payment enforced on the buyer side (atomic USDC, 6 decimals): 1 USDC. */
export const MAX_ATOMIC_PER_PAYMENT = 1_000_000n;
/** Payment headers larger than this are rejected before parsing. */
export const MAX_PAYMENT_HEADER_BYTES = 16_384;

export function explorerTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

/** x402 Money string for a whole-cent USDC atomic amount: "500000" → "$0.50". */
export function atomicToMoney(amountAtomic: string): string {
  const n = BigInt(amountAtomic);
  if (n % 10_000n !== 0n) throw new Error("x402 demo prices must be whole cents of USDC");
  const cents = n / 10_000n;
  return `$${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export function cdpCredentialsPresent(): boolean {
  return !!(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET && process.env.CDP_WALLET_SECRET);
}
