import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, requireSubscription } from "@/lib/permissions";
import { rentalRequestSchema } from "@/lib/validation";
import { requestRental } from "@/lib/services/rentals";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  await requireSubscription(user.id); // gate: must be subscribed to borrow
  const body = rentalRequestSchema.parse(await req.json());
  const rental = await requestRental({
    inventoryItemId: body.inventoryItemId,
    borrowerId: user.id,
    periodDays: body.periodDays,
  });
  return NextResponse.json({ rental }, { status: 201 });
});
