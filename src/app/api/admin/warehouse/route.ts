import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { listingSchema } from "@/lib/validation/listing";
import { createListing } from "@/lib/services/catalog";

// Admin-only: create a platform-owned (warehouse) inventory copy.
export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const item = await createListing({ input: parsed.data, ownerId: null });
  return NextResponse.json({ item }, { status: 201 });
}
