import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/permissions";
import { createReview, ReviewError } from "@/lib/services/reviews";

const schema = z.object({
  rentalId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const review = await createReview({
      rentalId: parsed.data.rentalId,
      raterId: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    if (err instanceof ReviewError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
