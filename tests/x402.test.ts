import { describe, expect, it } from "vitest";
import { centsToAtomicUsdc, centsToMoney, explorerTxUrl, testChargeCents } from "../convex/lib/x402";

describe("x402 test pricing", () => {
  it("scales list price down for the testnet faucet, never below 1 cent", () => {
    expect(testChargeCents(4900)).toBe(49);
    expect(testChargeCents(2900, 100)).toBe(29);
    expect(testChargeCents(4900, 1)).toBe(4900);
    expect(testChargeCents(10, 100)).toBe(1);
    expect(() => testChargeCents(-1)).toThrow();
    expect(() => testChargeCents(100, 0)).toThrow();
  });
  it("formats Money strings and USDC atomic units (6 decimals)", () => {
    expect(centsToMoney(49)).toBe("$0.49");
    expect(centsToAtomicUsdc(49)).toBe("490000");
    expect(centsToAtomicUsdc(100)).toBe("1000000");
  });
  it("links to the Base Sepolia explorer", () => {
    expect(explorerTxUrl("0xabc")).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});
