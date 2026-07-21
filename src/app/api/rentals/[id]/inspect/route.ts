import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/permissions";
import { inspectRental, RentalError } from "@/lib/services/rentals";

const schema = z.object({
  outcome: z.enum(["complete", "dispute"]),
  disputeReason: z.string().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const rental = await inspectRental({
      rentalId: params.id,
      actorId: user.id,
      actorIsAdmin: user.role === "ADMIN",
      outcome: parsed.data.outcome,
      disputeReason: parsed.data.disputeReason,
    });
    return NextResponse.json({ rental });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
