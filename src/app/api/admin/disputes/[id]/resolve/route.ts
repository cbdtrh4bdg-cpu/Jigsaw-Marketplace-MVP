import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/permissions";
import { resolveDispute, RentalError } from "@/lib/services/rentals";

const schema = z.object({
  forfeitCents: z.coerce.number().int().min(0),
  notes: z.string().max(1000).optional(),
});

// `id` is the rental id whose dispute is being resolved.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const rental = await resolveDispute({
      rentalId: params.id,
      adminId: user.id,
      forfeitCents: parsed.data.forfeitCents,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ rental });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
