import { REVENUE_SHARE, FEE_TIERS } from "@/lib/config";
import { roundCents } from "@/lib/money";

/**
 * Blended revenue-share math. Owner payout is driven by an Owner Standing score
 * that blends CONTRIBUTION (how much distinct inventory you add — capped so
 * bloat can't climb tiers) with DEMAND (how wanted your titles actually are).
 *
 * These are pure functions — no DB — so the anti-bloat invariant is unit
 * tested cheaply. The DB-facing resolver that gathers signals lives in
 * resolveRevenueShare() below.
 */

export interface TitleSignals {
  completedRentals: number;
  favorites: number;
  avgRating: number; // 0..5, 0 if no reviews
}

/** popularity(title), normalized to 0..100. */
export function titlePopularity(s: TitleSignals): number {
  const { alpha, beta, gamma, popularityRawCeiling } = REVENUE_SHARE;
  const raw = alpha * s.completedRentals + beta * s.favorites + gamma * s.avgRating;
  const normalized = (raw / popularityRawCeiling) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Owner Standing summed over the owner's distinct active titles.
 * contribution = min(contributionPerTitle * distinctTitles, contribCap)
 * demand       = Σ popularity(title)/100
 */
export function ownerStanding(titlePopularities: number[]): {
  contribution: number;
  demand: number;
  standing: number;
} {
  const distinctTitles = titlePopularities.length;
  const contribution = Math.min(
    REVENUE_SHARE.contributionPerTitle * distinctTitles,
    REVENUE_SHARE.contribCap,
  );
  const demand = titlePopularities.reduce((sum, p) => sum + p / 100, 0);
  return { contribution, demand, standing: contribution + demand };
}

/** Platform fee (basis points) for a given standing — last matching tier wins. */
export function platformFeeBpsForStanding(standing: number): number {
  let bps = FEE_TIERS[0].platformFeeBps;
  for (const tier of FEE_TIERS) {
    if (standing >= tier.minStanding) bps = tier.platformFeeBps;
  }
  return bps;
}

/** Per-rental popularity bonus (basis points), capped. */
export function popularityBonusBps(titlePopularityValue: number): number {
  const raw = REVENUE_SHARE.delta * titlePopularityValue * 100; // delta * pop%  -> bps
  return Math.min(Math.round(raw), REVENUE_SHARE.maxPopularityBonusBps);
}

export interface SplitResult {
  ownerStanding: number;
  platformFeeBps: number;
  popularityBonusBps: number;
  ownerPayoutCents: number;
  platformCents: number;
}

/**
 * Split a rental fee between owner and platform given the owner's standing and
 * the rented title's popularity. Warehouse copies (ownerStanding undefined)
 * keep 100% with the platform.
 */
export function splitRentalFee(
  feeCents: number,
  standing: number | null,
  rentedTitlePopularity: number,
): SplitResult {
  if (standing === null) {
    return {
      ownerStanding: 0,
      platformFeeBps: 10000,
      popularityBonusBps: 0,
      ownerPayoutCents: 0,
      platformCents: feeCents,
    };
  }

  const platformFeeBps = platformFeeBpsForStanding(standing);
  const baseOwnerBps = 10000 - platformFeeBps;
  const bonusBps = popularityBonusBps(rentedTitlePopularity);

  // Bonus nudges the owner's share up (bounded so platform share stays >= 0).
  const ownerBps = Math.min(10000, baseOwnerBps + Math.round((baseOwnerBps * bonusBps) / 10000));
  const ownerPayoutCents = roundCents((feeCents * ownerBps) / 10000);
  const platformCents = feeCents - ownerPayoutCents;

  return {
    ownerStanding: standing,
    platformFeeBps,
    popularityBonusBps: bonusBps,
    ownerPayoutCents,
    platformCents,
  };
}
