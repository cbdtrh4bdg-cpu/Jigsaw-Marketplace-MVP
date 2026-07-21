import { prisma } from "@/lib/db";

/** Toggle a user's wishlist favorite for a catalog title. */
export async function toggleFavorite(userId: string, catalogItemId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_catalogItemId: { userId, catalogItemId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }
  await prisma.favorite.create({ data: { userId, catalogItemId } });
  return { favorited: true };
}
