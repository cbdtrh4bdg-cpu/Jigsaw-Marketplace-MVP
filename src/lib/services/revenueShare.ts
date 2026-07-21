import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/services/payments";
import {
  titlePopularity,
  ownerStanding,
  computePayout,
} from "@/lib/services/revenueShareMath";

// Re-export the pure math so callers have a single import site.
export * from "@/lib/services/revenueShareMath";

// ---------------------------------------------------------------------------
// DB-backed aggregation.
// ---------------------------------------------------------------------------

/** Gather demand signals for a single title and compute its popularity. */
export async function titlePopularityFromDb(catalogItemId: string): Promise<number> {
  const [completedRentals, favorites, ratingAgg] = await Promise.all([
    prisma.rental.count({
      where: {
        status: "COMPLETED",
        inventoryItem: { catalogItemId },
      },
    }),
    prisma.favorite.count({ where: { catalogItemId } }),
    prisma.review.aggregate({
      where: { catalogItemId },
      _avg: { rating: true },
    }),
  ]);
  return titlePopularity({
    completedRentals,
    favorites,
    avgRating: ratingAgg._avg.rating,
  });
}

/** Compute an owner's current standing from their active listings. */
export async function ownerStandingFromDb(ownerId: string): Promise<number> {
  const items = await prisma.inventoryItem.findMany({
    where: { ownerId, source: "USER", status: { not: "RETIRED" } },
    select: { catalogItemId: true },
  });
  const distinctTitleIds = Array.from(new Set(items.map((i) => i.catalogItemId)));
  const titlePopularities = await Promise.all(
    distinctTitleIds.map((id) => titlePopularityFromDb(id)),
  );
  return ownerStanding({
    distinctActiveTitles: distinctTitleIds.length,
    titlePopularities,
  });
}

/**
 * Settle the revenue split for a completed rental. Writes a locked-in
 * RevenueShareEntry and moves the money. Warehouse copies (no owner) keep 100%
 * with the platform. Idempotent per rental.
 */
export async function settleRevenueShare(rentalId: string) {
  const existing = await prisma.revenueShareEntry.findUnique({
    where: { rentalId },
  });
  if (existing) return existing;

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: { inventoryItem: true },
  });
  if (!rental) throw new Error("Rental not found");

  const gross = rental.quotedFeeCents;
  const ownerId = rental.inventoryItem.ownerId;
  const payments = getPaymentProvider();

  // Warehouse copy: platform keeps everything.
  if (!ownerId) {
    const entry = await prisma.revenueShareEntry.create({
      data: {
        rentalId,
        ownerId: null,
        grossRentalFeeCents: gross,
        ownerStanding: 0,
        platformFeePct: 100,
        platformFeeCents: gross,
        popularityBonusCents: 0,
        ownerPayoutCents: 0,
      },
    });
    if (gross > 0) await payments.recordPlatformFee(rentalId, gross);
    return entry;
  }

  const [standing, rentedPopularity] = await Promise.all([
    ownerStandingFromDb(ownerId),
    titlePopularityFromDb(rental.inventoryItem.catalogItemId),
  ]);
  const breakdown = computePayout({
    grossRentalFeeCents: gross,
    standing,
    rentedTitlePopularity: rentedPopularity,
  });

  const entry = await prisma.revenueShareEntry.create({
    data: { rentalId, ownerId, ...breakdown },
  });

  if (breakdown.ownerPayoutCents > 0) {
    await payments.payoutOwner(ownerId, rentalId, breakdown.ownerPayoutCents);
  }
  if (breakdown.platformFeeCents > 0) {
    await payments.recordPlatformFee(rentalId, breakdown.platformFeeCents);
  }
  return entry;
}
