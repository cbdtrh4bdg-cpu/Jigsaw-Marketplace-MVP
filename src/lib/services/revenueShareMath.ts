// Pure revenue-share math — no DB imports, directly unit-testable.
// All the reward model's tunable knobs live in REVENUE_CONSTANTS.

export const REVENUE_CONSTANTS = {
  // Title popularity (0–100) component caps. Favorites give a demand signal
  // even before any rental history (solves cold-start).
  POP_RENTAL_POINTS: 10, // per completed rental
  POP_RENTAL_CAP: 50,
  POP_FAVORITE_POINTS: 6, // per wishlist/favorite
  POP_FAVORITE_CAP: 30,
  POP_RATING_CAP: 20, // scaled from avg rating (0–5)

  // Owner standing.
  CONTRIB_PER_TITLE: 0.5, // each distinct active title
  CONTRIB_CAP: 4, // pure-volume ceiling — top tiers need demand, not bloat
  // Demand is weighted so it OUT-RANKS bloat: a single maximally-popular title
  // (demand = 5.0) reaches a higher tier than any number of zero-popularity
  // listings (capped at CONTRIB_CAP = 4). demand = sum(popularity/100)*weight.
  DEMAND_WEIGHT: 5,

  // Per-rental popularity bonus: payout *= 1 + BONUS_MAX * popularity/100.
  BONUS_MAX: 0.2,
} as const;

export interface Tier {
  platformFeePct: number;
  ownerPayoutPct: number;
}

/** Title desirability, 0–100, from real demand signals. */
export function titlePopularity(input: {
  completedRentals: number;
  favorites: number;
  avgRating: number | null; // 0–5, null when no reviews
}): number {
  const c = REVENUE_CONSTANTS;
  const rentalPart = Math.min(
    c.POP_RENTAL_CAP,
    input.completedRentals * c.POP_RENTAL_POINTS,
  );
  const favPart = Math.min(
    c.POP_FAVORITE_CAP,
    input.favorites * c.POP_FAVORITE_POINTS,
  );
  const ratingPart = input.avgRating
    ? (input.avgRating / 5) * c.POP_RATING_CAP
    : 0;
  return Math.min(100, rentalPart + favPart + ratingPart);
}

/**
 * Owner Standing = capped contribution + weighted demand. Bloat (many
 * unpopular listings) plateaus at CONTRIB_CAP; the top tiers require demand.
 */
export function ownerStanding(input: {
  distinctActiveTitles: number;
  titlePopularities: number[]; // popularity (0–100) of each distinct title
}): number {
  const c = REVENUE_CONSTANTS;
  const contribution = Math.min(
    c.CONTRIB_PER_TITLE * input.distinctActiveTitles,
    c.CONTRIB_CAP,
  );
  const demand = input.titlePopularities.reduce(
    (s, p) => s + (p / 100) * c.DEMAND_WEIGHT,
    0,
  );
  return contribution + demand;
}

/** Map a standing score to a platform-fee / owner-payout tier. */
export function tierForStanding(standing: number): Tier {
  if (standing >= 10) return { platformFeePct: 10, ownerPayoutPct: 90 };
  if (standing >= 5) return { platformFeePct: 20, ownerPayoutPct: 80 };
  if (standing >= 2) return { platformFeePct: 30, ownerPayoutPct: 70 };
  return { platformFeePct: 40, ownerPayoutPct: 60 };
}

/** Per-rental payout multiplier from the rented title's popularity. */
export function popularityBonusMultiplier(popularity: number): number {
  return 1 + REVENUE_CONSTANTS.BONUS_MAX * (popularity / 100);
}

export interface PayoutBreakdown {
  grossRentalFeeCents: number;
  ownerStanding: number;
  platformFeePct: number;
  platformFeeCents: number;
  popularityBonusCents: number;
  ownerPayoutCents: number;
}

/** Compute the full split for a P2P rental given the money + scores. */
export function computePayout(input: {
  grossRentalFeeCents: number;
  standing: number;
  rentedTitlePopularity: number;
}): PayoutBreakdown {
  const tier = tierForStanding(input.standing);
  const platformFeeCents = Math.round(
    (input.grossRentalFeeCents * tier.platformFeePct) / 100,
  );
  const basePayout = input.grossRentalFeeCents - platformFeeCents;
  const multiplier = popularityBonusMultiplier(input.rentedTitlePopularity);
  const withBonus = Math.round(basePayout * multiplier);
  const popularityBonusCents = withBonus - basePayout;
  return {
    grossRentalFeeCents: input.grossRentalFeeCents,
    ownerStanding: input.standing,
    platformFeePct: tier.platformFeePct,
    platformFeeCents,
    popularityBonusCents,
    ownerPayoutCents: withBonus,
  };
}
