import { ALLOWED_PERIOD_DAYS } from "@/lib/config";

/**
 * Quote the rental fee for a chosen period. Linear by default —
 * fee = ratePerWeek * weeks — so a longer loan costs more (the owner is
 * without their item longer). Change ONLY this function to introduce a
 * long-term discount or premium; every call site stays untouched.
 */
export function quoteRentalFeeCents(
  ratePerWeekCents: number,
  periodDays: number,
): number {
  const weeks = periodDays / 7;
  return Math.round(ratePerWeekCents * weeks);
}

export function isAllowedPeriod(periodDays: number): boolean {
  return ALLOWED_PERIOD_DAYS.includes(periodDays);
}

/** Prorated overage fee for a late return (used when enforcing due dates). */
export function lateFeeCents(
  ratePerWeekCents: number,
  daysLate: number,
): number {
  if (daysLate <= 0) return 0;
  return Math.round((ratePerWeekCents / 7) * daysLate);
}
