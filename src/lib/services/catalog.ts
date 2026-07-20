import { prisma } from "@/lib/db";
import { InventorySource, Prisma } from "@prisma/client";
import { getCategoryModule } from "@/lib/categories";
import type { ListingInput } from "@/lib/validation";

/**
 * Create a physical inventory copy, upserting its catalog title. Shared by
 * member P2P listings (source USER) and admin warehouse stock (source
 * WAREHOUSE, ownerId null). Rates/deposits default from the category module
 * when the caller doesn't set them explicitly.
 */
export async function createListing(input: {
  data: ListingInput;
  source: InventorySource;
  ownerId: string | null;
}) {
  const { data, source, ownerId } = input;
  const mod = getCategoryModule(data.category);
  const attributes = mod.attributeSchema.parse(data.attributes) as Record<
    string,
    unknown
  >;

  const catalogItem = await prisma.catalogItem.upsert({
    where: {
      category_title_brand: {
        category: data.category,
        title: data.title,
        brand: data.brand ?? "",
      },
    },
    create: {
      category: data.category,
      title: data.title,
      brand: data.brand ?? "",
      imageUrl: data.imageUrl || null,
      attributes: attributes as Prisma.InputJsonValue,
    },
    update: {
      imageUrl: data.imageUrl || undefined,
      attributes: attributes as Prisma.InputJsonValue,
    },
  });

  return prisma.inventoryItem.create({
    data: {
      catalogItemId: catalogItem.id,
      source,
      ownerId,
      condition: data.condition,
      ratePerWeekCents:
        data.ratePerWeekCents ?? mod.defaultRatePerWeekCents(attributes as never),
      depositCents:
        data.depositCents ?? mod.defaultDepositCents(attributes as never),
    },
    include: { catalogItem: true },
  });
}
