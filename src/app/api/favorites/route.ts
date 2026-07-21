import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/permissions";
import { toggleFavorite } from "@/lib/services/favorites";

const schema = z.object({ catalogItemId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await toggleFavorite(user.id, parsed.data.catalogItemId);
  return NextResponse.json(result);
}
