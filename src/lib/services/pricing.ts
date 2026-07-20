import { roundCents } from "@/lib/money";

/**
 * Duration-based rental pricing.
 *
 * Fee scales with the chosen period: quotedFee = ratePerWeekCents * weeks.
 * Linear by default — a longer-term discount/premium is a one-line change here
 * and nowhere else.
 */
export function quoteRentalFeeCents(
  ratePerWeekCents: number,
  periodDays: number,
): number {
  if (ratePerWeekCents < 0) throw new Error("ratePerWeekCents must be >= 0");
  if (periodDays <= 0) throw new Error("periodDays must be > 0");
  const weeks = periodDays / 7;
  return roundCents(ratePerWeekCents * weeks);
}

/** dueAt = start + periodDays. */
export function computeDueAt(start: Date, periodDays: number): Date {
  const due = new Date(start);
  due.setDate(due.getDate() + periodDays);
  return due;
}

/**
 * Late overage: prorated weekly rate for days past due. Modeled now; charging
 * is a Phase-3 stretch.
 */
export function overageFeeCents(
  ratePerWeekCents: number,
  dueAt: Date,
  returnShippedAt: Date,
): number {
  const msLate = returnShippedAt.getTime() - dueAt.getTime();
  if (msLate <= 0) return 0;
  const daysLate = Math.ceil(msLate / (1000 * 60 * 60 * 24));
  return roundCents((ratePerWeekCents / 7) * daysLate);
}

/**
 * Apply subscription credits (each credit offsets one full rental fee up to the
 * plan's per-credit ceiling — here 1 credit == the whole quoted fee, capped).
 * Returns the amount actually charged and credits consumed.
 */
export function applyCredits(
  quotedFeeCents: number,
  creditsRemaining: number,
): { chargeCents: number; creditsApplied: number } {
  if (quotedFeeCents <= 0 || creditsRemaining <= 0) {
    return { chargeCents: Math.max(0, quotedFeeCents), creditsApplied: 0 };
  }
  // One credit covers one rental fee in this MVP.
  return { chargeCents: 0, creditsApplied: 1 };
}
