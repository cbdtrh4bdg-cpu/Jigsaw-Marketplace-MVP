import { NextRequest, NextResponse } from "next/server";
import { RentalStatus } from "@/lib/db-types";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { reviewSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const body = reviewSchema.parse(await req.json());
  const db = supabaseAdmin();

  // Only members who've actually completed a rental of this title may review it.
  const { data: invRows } = await db
    .from("InventoryItem")
    .select("id")
    .eq("catalogItemId", body.catalogItemId);
  const invIds = (invRows as { id: string }[] | null)?.map((r) => r.id) ?? [];

  let completed = 0;
  if (invIds.length > 0) {
    const { count } = await db
      .from("Rental")
      .select("*", { head: true, count: "exact" })
      .eq("borrowerId", user.id)
      .eq("status", RentalStatus.COMPLETED)
      .in("inventoryItemId", invIds);
    completed = count ?? 0;
  }
  if (completed === 0) {
    return NextResponse.json(
      { error: "You can review a puzzle only after completing a rental of it" },
      { status: 403 },
    );
  }

  const { data, error } = await db
    .from("Review")
    .upsert(
      {
        userId: user.id,
        catalogItemId: body.catalogItemId,
        rating: body.rating,
        comment: body.comment ?? null,
      },
      { onConflict: "userId,catalogItemId" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Review failed: ${error.message}`);
  return NextResponse.json({ review: data }, { status: 201 });
});
