import { supabaseAdmin } from "@/lib/supabase";
import { InventoryStatus, RentalStatus } from "@/lib/db-types";
import {
  ownerStanding,
  splitRentalFee,
  titlePopularity,
  type SplitResult,
  type TitleSignals,
} from "./revenueShare";

function db() {
  return supabaseAdmin();
}

async function count(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (q: any) => any,
  table: string,
): Promise<number> {
  const q = db().from(table).select("*", { count: "exact", head: true });
  const { count: c, error } = await build(q);
  if (error) throw new Error(`Supabase count error: ${error.message}`);
  return (c as number | null) ?? 0;
}

async function inventoryIdsForTitle(catalogItemId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("InventoryItem")
    .select("id")
    .eq("catalogItemId", catalogItemId);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (data as { id: string }[]).map((r) => r.id);
}

/** Gather the demand signals for a single catalog title. */
export async function getTitleSignals(catalogItemId: string): Promise<TitleSignals> {
  const invIds = await inventoryIdsForTitle(catalogItemId);

  const [completedRentals, favorites, ratingsRes] = await Promise.all([
    invIds.length === 0
      ? Promise.resolve(0)
      : count(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q: any) => q.eq("status", RentalStatus.COMPLETED).in("inventoryItemId", invIds),
          "Rental",
        ),
    count(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => q.eq("catalogItemId", catalogItemId),
      "Favorite",
    ),
    db().from("Review").select("rating").eq("catalogItemId", catalogItemId),
  ]);

  const ratings = (ratingsRes.data as { rating: number }[] | null) ?? [];
  const avgRating =
    ratings.length === 0
      ? 0
      : ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

  return { completedRentals, favorites, avgRating };
}

export async function getTitlePopularity(catalogItemId: string): Promise<number> {
  return titlePopularity(await getTitleSignals(catalogItemId));
}

/**
 * Compute an owner's current standing from their distinct active titles
 * (AVAILABLE or RESERVED inventory). De-dupes titles.
 */
export async function computeOwnerStanding(ownerId: string): Promise<number> {
  const { data, error } = await db()
    .from("InventoryItem")
    .select("catalogItemId")
    .eq("ownerId", ownerId)
    .in("status", [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED]);
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const titleIds = [
    ...new Set((data as { catalogItemId: string }[]).map((r) => r.catalogItemId)),
  ];
  const popularities = await Promise.all(titleIds.map((id) => getTitlePopularity(id)));
  return ownerStanding(popularities).standing;
}

/**
 * Resolve the full owner/platform split for a rental at completion time.
 * Warehouse copies (ownerId null) keep 100% with the platform.
 */
export async function resolveRevenueShare(
  rentalId: string,
): Promise<SplitResult & { ownerId: string | null; feeCents: number }> {
  const { data: rental, error } = await db()
    .from("Rental")
    .select("quotedFeeCents, inventoryItemId")
    .eq("id", rentalId)
    .single();
  if (error) throw new Error(`Supabase error: ${error.message}`);

  const { data: inv } = await db()
    .from("InventoryItem")
    .select("ownerId, catalogItemId")
    .eq("id", (rental as { inventoryItemId: string }).inventoryItemId)
    .single();

  const feeCents = (rental as { quotedFeeCents: number }).quotedFeeCents;
  const ownerId = (inv as { ownerId: string | null }).ownerId;
  const catalogItemId = (inv as { catalogItemId: string }).catalogItemId;
  const titlePop = await getTitlePopularity(catalogItemId);

  if (!ownerId) {
    return { ...splitRentalFee(feeCents, null, titlePop), ownerId: null, feeCents };
  }
  const standing = await computeOwnerStanding(ownerId);
  return { ...splitRentalFee(feeCents, standing, titlePop), ownerId, feeCents };
}
