import { describe, expect, it } from "vitest";
import {
  applyCredits,
  computeDueAt,
  overageFeeCents,
  quoteRentalFeeCents,
} from "@/lib/services/pricing";

describe("pricing", () => {
  it("scales the fee linearly with the period", () => {
    expect(quoteRentalFeeCents(600, 7)).toBe(600); // 1 week
    expect(quoteRentalFeeCents(600, 14)).toBe(1200); // 2 weeks
    expect(quoteRentalFeeCents(600, 28)).toBe(2400); // 4 weeks
  });

  it("a longer term costs strictly more", () => {
    const oneWeek = quoteRentalFeeCents(500, 7);
    const fourWeek = quoteRentalFeeCents(500, 28);
    expect(fourWeek).toBeGreaterThan(oneWeek);
  });

  it("rejects nonsensical inputs", () => {
    expect(() => quoteRentalFeeCents(-1, 7)).toThrow();
    expect(() => quoteRentalFeeCents(500, 0)).toThrow();
  });

  it("computes dueAt from the period", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(computeDueAt(start, 14).toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("charges overage only when returned late", () => {
    const due = new Date("2026-01-15T00:00:00Z");
    expect(overageFeeCents(700, due, new Date("2026-01-14T00:00:00Z"))).toBe(0);
    // 7 days late at 700/wk == 700
    expect(overageFeeCents(700, due, new Date("2026-01-22T00:00:00Z"))).toBe(700);
  });

  it("applies one credit to fully offset a rental fee", () => {
    expect(applyCredits(1200, 0)).toEqual({ chargeCents: 1200, creditsApplied: 0 });
    expect(applyCredits(1200, 2)).toEqual({ chargeCents: 0, creditsApplied: 1 });
  });
});
