import { describe, expect, it } from "vitest";
import { atomicToMoney, explorerTxUrl } from "../convex/lib/x402";
import { dollarsToAtomic, formatAtomic, splitRevenue, sumAtomic } from "../convex/lib/money";

describe("x402 pricing in atomic units", () => {
  it("converts whole-cent USDC atomic amounts to x402 Money strings", () => {
    expect(atomicToMoney("500000")).toBe("$0.50");
    expect(atomicToMoney("1000000")).toBe("$1.00");
    expect(atomicToMoney("100000")).toBe("$0.10");
    expect(() => atomicToMoney("123456")).toThrow();
  });
  it("parses and formats display prices without floating point", () => {
    expect(dollarsToAtomic("0.5")).toBe("500000");
    expect(dollarsToAtomic("1.00")).toBe("1000000");
    expect(dollarsToAtomic("0.123")).toBeNull();
    expect(formatAtomic("500000")).toBe("0.50");
    expect(formatAtomic("1234567")).toBe("1.234567");
  });
  it("splits revenue exactly and sums to gross", () => {
    for (const a of ["0", "1", "7", "500000", "1000000", "999999"]) {
      const s = splitRevenue(a);
      expect(sumAtomic([s.contributorShareAtomic, s.platformShareAtomic])).toBe(a);
    }
    expect(splitRevenue("1000000")).toEqual({ contributorShareAtomic: "800000", platformShareAtomic: "200000" });
  });
  it("links to the Base Sepolia explorer", () => {
    expect(explorerTxUrl("0xabc")).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});
