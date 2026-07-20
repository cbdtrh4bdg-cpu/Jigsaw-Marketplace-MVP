import { NextRequest, NextResponse } from "next/server";
import { InventorySource } from "@/lib/db-types";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { listingSchema } from "@/lib/validation";
import { createListing } from "@/lib/services/catalog";

// Create a P2P (USER-owned) listing.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const data = listingSchema.parse(await req.json());
  const item = await createListing({
    data,
    source: InventorySource.USER,
    ownerId: user.id,
  });
  return NextResponse.json({ item }, { status: 201 });
});
