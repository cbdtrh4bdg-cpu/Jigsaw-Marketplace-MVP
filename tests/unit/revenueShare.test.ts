import { describe, it, expect } from "vitest";
import {
  titlePopularity,
  ownerStanding,
  tierForStanding,
  computePayout,
  popularityBonusMultiplier,
} from "@/lib/services/revenueShareMath";

describe("titlePopularity", () => {
  it("is 0 for a brand-new unwanted title", () => {
    expect(
      titlePopularity({ completedRentals: 0, favorites: 0, avgRating: null }),
    ).toBe(0);
  });

  it("gives a demand signal from favorites before any rentals (cold-start)", () => {
    const pop = titlePopularity({
      completedRentals: 0,
      favorites: 5,
      avgRating: null,
    });
    expect(pop).toBeGreaterThan(0);
  });

  it("is capped at 100", () => {
    const pop = titlePopularity({
      completedRentals: 100,
      favorites: 100,
      avgRating: 5,
    });
    expect(pop).toBeLessThanOrEqual(100);
  });
});

describe("ownerStanding", () => {
  it("caps pure contribution so bloat plateaus", () => {
    const eight = ownerStanding({
      distinctActiveTitles: 8,
      titlePopularities: Array(8).fill(0),
    });
    const fifty = ownerStanding({
      distinctActiveTitles: 50,
      titlePopularities: Array(50).fill(0),
    });
    // Adding more zero-popularity titles beyond the cap doesn't help.
    expect(eight).toBe(fifty);
    expect(fifty).toBe(4); // CONTRIB_CAP
  });

  it("rewards demand on top of contribution", () => {
    const withDemand = ownerStanding({
      distinctActiveTitles: 1,
      titlePopularities: [100],
    });
    expect(withDemand).toBeGreaterThan(4);
  });
});

describe("tierForStanding", () => {
  it("maps standing to the right platform fee", () => {
    expect(tierForStanding(0.5).ownerPayoutPct).toBe(60);
    expect(tierForStanding(3).ownerPayoutPct).toBe(70);
    expect(tierForStanding(6).ownerPayoutPct).toBe(80);
    expect(tierForStanding(12).ownerPayoutPct).toBe(90);
  });
});

describe("ANTI-BLOAT INVARIANT", () => {
  it("one highly-popular title out-ranks any number of unwanted listings", () => {
    const bloat = ownerStanding({
      distinctActiveTitles: 30,
      titlePopularities: Array(30).fill(0), // 30 junk listings
    });
    const oneBlockbuster = ownerStanding({
      distinctActiveTitles: 1,
      titlePopularities: [100], // one very-wanted title
    });

    // The popular owner reaches a strictly better tier than the hoarder.
    expect(tierForStanding(oneBlockbuster).ownerPayoutPct).toBeGreaterThan(
      tierForStanding(bloat).ownerPayoutPct,
    );
  });

  it("at equal rental fee, the popular title pays the owner more", () => {
    const fee = 1000;
    const bloatOwner = computePayout({
      grossRentalFeeCents: fee,
      standing: ownerStanding({
        distinctActiveTitles: 30,
        titlePopularities: Array(30).fill(0),
      }),
      rentedTitlePopularity: 0,
    });
    const popularOwner = computePayout({
      grossRentalFeeCents: fee,
      standing: ownerStanding({
        distinctActiveTitles: 1,
        titlePopularities: [100],
      }),
      rentedTitlePopularity: 100,
    });
    expect(popularOwner.ownerPayoutCents).toBeGreaterThan(
      bloatOwner.ownerPayoutCents,
    );
  });
});

describe("computePayout", () => {
  it("splits by tier and adds the popularity bonus", () => {
    const b = computePayout({
      grossRentalFeeCents: 1000,
      standing: 12, // 90% owner / 10% platform
      rentedTitlePopularity: 100, // +20% bonus on the base payout
    });
    expect(b.platformFeePct).toBe(10);
    expect(b.platformFeeCents).toBe(100);
    // base payout 900, bonus +20% => 1080
    expect(b.popularityBonusCents).toBe(180);
    expect(b.ownerPayoutCents).toBe(1080);
  });

  it("warehouse-style zero popularity has no bonus multiplier effect", () => {
    expect(popularityBonusMultiplier(0)).toBe(1);
  });
});
