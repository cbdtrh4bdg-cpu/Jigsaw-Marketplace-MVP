import { describe, expect, it } from "vitest";
import {
  ownerStanding,
  platformFeeBpsForStanding,
  popularityBonusBps,
  splitRentalFee,
  titlePopularity,
} from "@/lib/services/revenueShare";
import { REVENUE_SHARE } from "@/lib/config";

describe("title popularity", () => {
  it("is 0 with no signals and rises with demand", () => {
    expect(titlePopularity({ completedRentals: 0, favorites: 0, avgRating: 0 })).toBe(0);
    const hot = titlePopularity({ completedRentals: 10, favorites: 20, avgRating: 5 });
    expect(hot).toBeGreaterThan(50);
  });

  it("clamps to 100", () => {
    const val = titlePopularity({ completedRentals: 999, favorites: 999, avgRating: 5 });
    expect(val).toBe(100);
  });

  it("favorites give a cold-start demand signal before any rentals", () => {
    const wishlisted = titlePopularity({ completedRentals: 0, favorites: 15, avgRating: 0 });
    expect(wishlisted).toBeGreaterThan(0);
  });
});

describe("owner standing", () => {
  it("caps contribution so pure volume tops out", () => {
    const many = ownerStanding(new Array(100).fill(0));
    expect(many.contribution).toBe(REVENUE_SHARE.contribCap);
    expect(many.demand).toBe(0);
    expect(many.standing).toBe(REVENUE_SHARE.contribCap);
  });

  it("adds demand on top of contribution", () => {
    const s = ownerStanding([100, 100, 100, 100]);
    expect(s.standing).toBeGreaterThan(REVENUE_SHARE.contribCap);
  });
});

describe("fee tiers", () => {
  it("maps standing to the right platform fee", () => {
    expect(platformFeeBpsForStanding(0)).toBe(4000);
    expect(platformFeeBpsForStanding(1.9)).toBe(4000);
    expect(platformFeeBpsForStanding(2)).toBe(3000);
    expect(platformFeeBpsForStanding(5)).toBe(2000);
    expect(platformFeeBpsForStanding(10)).toBe(1000);
    expect(platformFeeBpsForStanding(50)).toBe(1000);
  });
});

describe("splitRentalFee", () => {
  it("warehouse copies keep 100% with the platform", () => {
    const s = splitRentalFee(1000, null, 100);
    expect(s.ownerPayoutCents).toBe(0);
    expect(s.platformCents).toBe(1000);
  });

  it("conserves money (owner + platform == fee)", () => {
    const s = splitRentalFee(1234, 6, 80);
    expect(s.ownerPayoutCents + s.platformCents).toBe(1234);
  });

  it("per-rental popularity bonus pays a hot title more than a cold one at equal fee & tier", () => {
    const cold = splitRentalFee(1000, 4, 0);
    const hot = splitRentalFee(1000, 4, 100);
    expect(hot.platformFeeBps).toBe(cold.platformFeeBps); // same tier
    expect(hot.popularityBonusBps).toBeGreaterThan(0);
    expect(hot.ownerPayoutCents).toBeGreaterThan(cold.ownerPayoutCents);
  });
});

describe("anti-bloat invariant", () => {
  it("N unpopular listings never out-earn one genuinely in-demand catalog at equal fee", () => {
    const fee = 2000;

    // Bloat owner: 12 junk titles, nobody wants them.
    const bloatPopularities = new Array(12).fill(0);
    const bloatStanding = ownerStanding(bloatPopularities).standing;
    // Rented one of the junk titles (popularity 0).
    const bloatSplit = splitRentalFee(fee, bloatStanding, 0);

    // In-demand owner: four blockbuster titles people actually rent & wishlist.
    const hotTitle = titlePopularity({ completedRentals: 12, favorites: 25, avgRating: 5 });
    const hotPopularities = [hotTitle, hotTitle, hotTitle, hotTitle];
    const hotStanding = ownerStanding(hotPopularities).standing;
    const hotSplit = splitRentalFee(fee, hotStanding, hotTitle);

    // Bloat is capped at the contribution ceiling; demand pushes the hot owner higher.
    expect(bloatStanding).toBe(REVENUE_SHARE.contribCap);
    expect(hotStanding).toBeGreaterThan(bloatStanding);
    expect(hotSplit.ownerPayoutCents).toBeGreaterThan(bloatSplit.ownerPayoutCents);
  });

  it("popularity bonus is capped", () => {
    expect(popularityBonusBps(100)).toBeLessThanOrEqual(REVENUE_SHARE.maxPopularityBonusBps);
  });
});
