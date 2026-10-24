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

/**
 * The CDP faucet hands out small amounts of test USDC, so test charges are the list price scaled
 * down (default 1/100: a $49.00 guide settles 0.49 test USDC). Never below 1 cent.
 */
export function testChargeCents(listPriceMinorUnits: number, divisor = 100): number {
  if (!Number.isInteger(listPriceMinorUnits) || listPriceMinorUnits < 0) throw new Error("Invalid price");
  if (!Number.isInteger(divisor) || divisor < 1) throw new Error("Invalid divisor");
  return Math.max(1, Math.round(listPriceMinorUnits / divisor));
}

/** "$0.49" — x402 Money string; the exact scheme converts it to USDC atomic units (6 decimals). */
export function centsToMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function centsToAtomicUsdc(cents: number): string {
  return String(BigInt(cents) * 10_000n);
}

export function cdpCredentialsPresent(): boolean {
  return !!(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET && process.env.CDP_WALLET_SECRET);
}

export function testDivisor(): number {
  const n = Number(process.env.X402_TEST_PRICE_DIVISOR ?? 100);
  return Number.isInteger(n) && n >= 1 ? n : 100;
}
