import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { listingSchema } from "@/lib/validation/listing";
import { createListing } from "@/lib/services/catalog";

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const item = await createListing({ input: parsed.data, ownerId: user.id });
  return NextResponse.json({ item }, { status: 201 });
}
