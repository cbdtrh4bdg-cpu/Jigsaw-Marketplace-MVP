import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { ItemCard } from "@/components/item-card";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyListingsPage() {
  const user = await requireSession();
  const items = await prisma.inventoryItem.findMany({
    where: { ownerId: user.id },
    include: {
      catalogItem: true,
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My listings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Puzzles you&apos;ve made available to the community.
          </p>
        </div>
        <Link
          href="/my-listings/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          List a puzzle
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">
            You haven&apos;t listed anything yet.{" "}
            <Link href="/my-listings/new" className="font-medium text-brand-600 hover:underline">
              List your first puzzle.
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <span className="absolute left-2 top-2 z-10 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                {titleCase(item.status)}
              </span>
              <ItemCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
