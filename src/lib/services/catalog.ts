import type { Category, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCategoryModule } from "@/lib/categories";
import type { ListingInput } from "@/lib/validation/listing";

/**
 * Create a P2P (or warehouse) listing: find-or-create the title-level
 * CatalogItem, then create a physical InventoryItem pointing at it.
 * When ratePerWeek/deposit aren't supplied, the category module derives
 * sensible defaults from the item's attributes.
 */
export async function createListing(params: {
  input: ListingInput;
  ownerId: string | null; // null => warehouse copy
}) {
  const { input, ownerId } = params;
  const category = input.category as Category;
  const mod = getCategoryModule(category);
  const attributes = input.attributes as Prisma.InputJsonValue;

  // Reuse an existing catalog title (same category + title + brand) so many
  // copies of the same puzzle share one catalog row.
  const brand = input.brand?.trim() || null;
  const existing = await prisma.catalogItem.findFirst({
    where: { category, title: input.title.trim(), brand },
  });

  const catalogItem =
    existing ??
    (await prisma.catalogItem.create({
      data: {
        category,
        title: input.title.trim(),
        brand,
        imageUrl: input.imageUrl?.trim() || null,
        attributes,
      },
    }));

  const ratePerWeekCents =
    input.ratePerWeekCents ??
    mod.defaultRatePerWeekCents(input.attributes as Record<string, unknown>);
  const depositCents =
    input.depositCents ??
    mod.defaultDepositCents(input.attributes as Record<string, unknown>);

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      catalogItemId: catalogItem.id,
      source: ownerId ? "USER" : "WAREHOUSE",
      ownerId,
      condition: input.condition,
      ratePerWeekCents,
      depositCents,
      status: "AVAILABLE",
    },
    include: { catalogItem: true },
  });

  return inventoryItem;
}

export type BrowseItem = Prisma.InventoryItemGetPayload<{
  include: { catalogItem: true; owner: { select: { id: true; name: true } } };
}>;

/** Available inventory for the browse grid, newest first. */
export async function listAvailableInventory(opts?: {
  category?: Category;
}): Promise<BrowseItem[]> {
  return prisma.inventoryItem.findMany({
    where: {
      status: "AVAILABLE",
      ...(opts?.category ? { catalogItem: { category: opts.category } } : {}),
    },
    include: {
      catalogItem: true,
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
