import { NextRequest, NextResponse } from "next/server";
import { RentalStatus } from "@prisma/client";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { reviewSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const body = reviewSchema.parse(await req.json());

  // Only members who've actually completed a rental of this title may review it.
  const completed = await prisma.rental.count({
    where: {
      borrowerId: user.id,
      status: RentalStatus.COMPLETED,
      inventoryItem: { catalogItemId: body.catalogItemId },
    },
  });
  if (completed === 0) {
    return NextResponse.json(
      { error: "You can review a puzzle only after completing a rental of it" },
      { status: 403 },
    );
  }

  const review = await prisma.review.upsert({
    where: {
      userId_catalogItemId: {
        userId: user.id,
        catalogItemId: body.catalogItemId,
      },
    },
    create: {
      userId: user.id,
      catalogItemId: body.catalogItemId,
      rating: body.rating,
      comment: body.comment,
    },
    update: { rating: body.rating, comment: body.comment },
  });
  return NextResponse.json({ review }, { status: 201 });
});
