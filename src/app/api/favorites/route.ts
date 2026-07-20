import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase";

const bodySchema = z.object({ catalogItemId: z.string().min(1) });

// Toggle a wishlist/favorite for the current user.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const { catalogItemId } = bodySchema.parse(await req.json());
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("Favorite")
    .select("id")
    .eq("userId", user.id)
    .eq("catalogItemId", catalogItemId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("Favorite")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(`Favorite delete failed: ${error.message}`);
    return NextResponse.json({ favorited: false });
  }

  const { error } = await db
    .from("Favorite")
    .insert({ userId: user.id, catalogItemId });
  if (error) throw new Error(`Favorite insert failed: ${error.message}`);
  return NextResponse.json({ favorited: true });
});
