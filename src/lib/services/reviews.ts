import { prisma } from "@/lib/db";

export class ReviewError extends Error {}

/** Borrower leaves a review for a completed rental (tied to the title). */
export async function createReview(params: {
  rentalId: string;
  raterId: string;
  rating: number;
  comment?: string;
}) {
  const rental = await prisma.rental.findUnique({
    where: { id: params.rentalId },
    include: { inventoryItem: true, reviews: true },
  });
  if (!rental) throw new ReviewError("Rental not found");
  if (rental.borrowerId !== params.raterId) throw new ReviewError("Not your rental");
  if (rental.status !== "COMPLETED") {
    throw new ReviewError("You can only review a completed rental");
  }
  if (rental.reviews.some((r) => r.raterId === params.raterId)) {
    throw new ReviewError("You already reviewed this rental");
  }

  return prisma.review.create({
    data: {
      rentalId: rental.id,
      raterId: params.raterId,
      catalogItemId: rental.inventoryItem.catalogItemId,
      rating: params.rating,
      comment: params.comment?.trim() || null,
    },
  });
}
