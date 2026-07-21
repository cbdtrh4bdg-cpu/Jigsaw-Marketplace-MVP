import Link from "next/link";
import { listAvailableInventory } from "@/lib/services/catalog";
import { ItemCard } from "@/components/item-card";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const items = await listAvailableInventory();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Browse the library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Community-lent and warehouse puzzles, all in one place.
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
            No puzzles available yet.{" "}
            <Link href="/my-listings/new" className="font-medium text-brand-600 hover:underline">
              Be the first to list one.
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} href={`/puzzles/${item.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
