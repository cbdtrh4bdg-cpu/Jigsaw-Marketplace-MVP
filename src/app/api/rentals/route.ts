import { NextResponse } from "next/server";
import { getApiUser, getActiveSubscription } from "@/lib/permissions";
import { rentalRequestSchema } from "@/lib/validation/rental";
import { requestRental, RentalError } from "@/lib/services/rentals";

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Borrowing requires an active subscription.
  const sub = await getActiveSubscription(user.id);
  if (!sub) {
    return NextResponse.json(
      { error: "An active subscription is required to borrow" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = rentalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const rental = await requestRental({
      borrowerId: user.id,
      inventoryItemId: parsed.data.inventoryItemId,
      periodDays: parsed.data.periodDays,
      useCredit: parsed.data.useCredit,
    });
    return NextResponse.json({ rental }, { status: 201 });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
