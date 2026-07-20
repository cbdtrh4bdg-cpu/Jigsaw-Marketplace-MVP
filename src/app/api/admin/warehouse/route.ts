import { NextRequest, NextResponse } from "next/server";
import { InventorySource } from "@prisma/client";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/permissions";
import { listingSchema } from "@/lib/validation";
import { createListing } from "@/lib/services/catalog";

// Add platform-owned (WAREHOUSE) inventory — ownerId is null.
export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();
  const data = listingSchema.parse(await req.json());
  const item = await createListing({
    data,
    source: InventorySource.WAREHOUSE,
    ownerId: null,
  });
  return NextResponse.json({ item }, { status: 201 });
});
