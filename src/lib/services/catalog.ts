import { supabaseAdmin } from "@/lib/supabase";
import {
  type CatalogItemRow,
  type InventoryItemRow,
  InventorySource,
} from "@/lib/db-types";
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
  const db = supabaseAdmin();
  const { data, source, ownerId } = input;
  const mod = getCategoryModule(data.category);
  const attributes = mod.attributeSchema.parse(data.attributes) as Record<
    string,
    unknown
  >;
  const brand = data.brand ?? "";

  // Upsert the catalog title on (category, title, brand).
  const { data: catalogRow, error: catalogErr } = await db
    .from("CatalogItem")
    .upsert(
      {
        category: data.category,
        title: data.title,
        brand,
        imageUrl: data.imageUrl || null,
        attributes,
      },
      { onConflict: "category,title,brand" },
    )
    .select("*")
    .single();
  if (catalogErr) throw new Error(`Catalog upsert failed: ${catalogErr.message}`);
  const catalogItem = catalogRow as CatalogItemRow;

  const { data: invRow, error: invErr } = await db
    .from("InventoryItem")
    .insert({
      catalogItemId: catalogItem.id,
      source,
      ownerId,
      condition: data.condition ?? null,
      ratePerWeekCents:
        data.ratePerWeekCents ?? mod.defaultRatePerWeekCents(attributes as never),
      depositCents:
        data.depositCents ?? mod.defaultDepositCents(attributes as never),
    })
    .select("*")
    .single();
  if (invErr) throw new Error(`Inventory insert failed: ${invErr.message}`);

  return { ...(invRow as InventoryItemRow), catalogItem };
}
