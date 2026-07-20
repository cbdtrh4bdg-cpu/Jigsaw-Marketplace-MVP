import { PayerRole } from "@prisma/client";

/**
 * Central tunables. Everything a product/ops person might want to change lives
 * here so call sites stay stable.
 */

// --- Rental periods -------------------------------------------------------
// Selectable borrow periods, in days. Extendable without code changes elsewhere.
export const RENTAL_PERIOD_DAYS = [7, 14, 28] as const;
export type RentalPeriodDays = (typeof RENTAL_PERIOD_DAYS)[number];

export function isValidPeriod(days: number): days is RentalPeriodDays {
  return (RENTAL_PERIOD_DAYS as readonly number[]).includes(days);
}

// --- Revenue-share weights (see src/lib/services/revenueShare.ts) ---------
export const REVENUE_SHARE = {
  // popularity(title) = normalize( α·completedRentals + β·favorites + γ·avgRating )
  alpha: 1.0, // weight on completed-rental count
  beta: 0.8, // weight on favorite/wishlist count
  gamma: 4.0, // weight on average review rating (0..5)
  // Normalization ceiling for the raw popularity score before clamping to 100.
  popularityRawCeiling: 40,

  // Owner Standing = contribution + demand
  contributionPerTitle: 0.5,
  contribCap: 4, // anti-bloat: pure volume tops out here
  // demand = Σ popularity(title)/100 over the owner's distinct active titles

  // Per-rental popularity bonus: payout *= 1 + delta * popularity/100 (capped)
  delta: 0.15,
  maxPopularityBonusBps: 1500, // +15% cap
} as const;

// Platform-fee tiers by Owner Standing. Ordered ascending by threshold; the
// LAST tier whose `minStanding` is <= standing wins.
export const FEE_TIERS: { minStanding: number; platformFeeBps: number }[] = [
  { minStanding: 0, platformFeeBps: 4000 }, // < 2   -> 40%
  { minStanding: 2, platformFeeBps: 3000 }, // 2..<5 -> 30%
  { minStanding: 5, platformFeeBps: 2000 }, // 5..<10-> 20%
  { minStanding: 10, platformFeeBps: 1000 }, // 10+  -> 10%
];

// --- Shipping policy ------------------------------------------------------
// MVP default: borrower pays both directions. Overridable via env so options
// 2/3 (platform-subsidized, split) are a config change, not a schema change.
function payer(envVal: string | undefined, fallback: PayerRole): PayerRole {
  const v = (envVal ?? "").toUpperCase();
  if (v === "BORROWER" || v === "LENDER" || v === "PLATFORM") {
    return v as PayerRole;
  }
  return fallback;
}

export const SHIPPING_POLICY = {
  outboundPaidBy: payer(process.env.SHIPPING_OUTBOUND_PAID_BY, PayerRole.BORROWER),
  returnPaidBy: payer(process.env.SHIPPING_RETURN_PAID_BY, PayerRole.BORROWER),
} as const;

// Deterministic simulated shipping cost in cents (flat, per leg).
export const SIMULATED_SHIPPING_COST_CENTS = 899;
