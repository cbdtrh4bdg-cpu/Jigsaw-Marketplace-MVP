import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ catalogItemId: z.string().min(1) });

// Toggle a wishlist/favorite for the current user.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const { catalogItemId } = bodySchema.parse(await req.json());

  const existing = await prisma.favorite.findUnique({
    where: { userId_catalogItemId: { userId: user.id, catalogItemId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }
  await prisma.favorite.create({ data: { userId: user.id, catalogItemId } });
  return NextResponse.json({ favorited: true });
});
