import type { Prisma, PrismaClient } from "@prisma/client";
import { InventoryStatus, RentalStatus } from "@prisma/client";
import {
  ownerStanding,
  splitRentalFee,
  titlePopularity,
  type SplitResult,
  type TitleSignals,
} from "./revenueShare";

type Db = PrismaClient | Prisma.TransactionClient;

/** Gather the demand signals for a single catalog title. */
export async function getTitleSignals(
  db: Db,
  catalogItemId: string,
): Promise<TitleSignals> {
  const [completedRentals, favorites, ratingAgg] = await Promise.all([
    db.rental.count({
      where: {
        inventoryItem: { catalogItemId },
        status: RentalStatus.COMPLETED,
      },
    }),
    db.favorite.count({ where: { catalogItemId } }),
    db.review.aggregate({
      where: { catalogItemId },
      _avg: { rating: true },
    }),
  ]);

  return {
    completedRentals,
    favorites,
    avgRating: ratingAgg._avg.rating ?? 0,
  };
}

export async function getTitlePopularity(
  db: Db,
  catalogItemId: string,
): Promise<number> {
  return titlePopularity(await getTitleSignals(db, catalogItemId));
}

/**
 * Compute an owner's current standing from their distinct active titles
 * (AVAILABLE or RESERVED inventory). De-dupes titles so listing the same puzzle
 * five times counts once.
 */
export async function computeOwnerStanding(
  db: Db,
  ownerId: string,
): Promise<number> {
  const items = await db.inventoryItem.findMany({
    where: {
      ownerId,
      status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED] },
    },
    select: { catalogItemId: true },
    distinct: ["catalogItemId"],
  });

  const popularities = await Promise.all(
    items.map((i) => getTitlePopularity(db, i.catalogItemId)),
  );
  return ownerStanding(popularities).standing;
}

/**
 * Resolve the full owner/platform split for a rental at completion time.
 * Warehouse copies (ownerId null) keep 100% with the platform.
 */
export async function resolveRevenueShare(
  db: Db,
  rentalId: string,
): Promise<SplitResult & { ownerId: string | null; feeCents: number }> {
  const rental = await db.rental.findUniqueOrThrow({
    where: { id: rentalId },
    include: { inventoryItem: true },
  });

  const feeCents = rental.quotedFeeCents;
  const ownerId = rental.inventoryItem.ownerId;
  const titlePop = await getTitlePopularity(db, rental.inventoryItem.catalogItemId);

  if (!ownerId) {
    const split = splitRentalFee(feeCents, null, titlePop);
    return { ...split, ownerId: null, feeCents };
  }

  const standing = await computeOwnerStanding(db, ownerId);
  const split = splitRentalFee(feeCents, standing, titlePop);
  return { ...split, ownerId, feeCents };
}
