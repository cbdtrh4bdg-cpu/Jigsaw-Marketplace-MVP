import Link from "next/link";
import { hasActiveSubscription } from "@/lib/permissions";
import { requireUserPage } from "@/lib/pageAuth";
import { InventoryStatus } from "@/lib/db-types";
import { listInventoryWithCatalog } from "@/lib/data";
import { PuzzleCard } from "@/components/PuzzleCard";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const user = await requireUserPage("/browse");

  if (!(await hasActiveSubscription(user.id))) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">Subscribe to browse</h1>
        <p className="mt-2 text-sm text-slate-600">
          An active subscription is required to browse the marketplace and
          request borrows.
        </p>
        <Link
          href="/subscribe"
          className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          View plans
        </Link>
      </Card>
    );
  }

  const items = await listInventoryWithCatalog({
    status: InventoryStatus.AVAILABLE,
  });
  const borrowable = items.filter((i) => i.ownerId !== user.id);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Browse puzzles</h1>
      <p className="mb-6 text-sm text-slate-500">
        {borrowable.length} available to borrow
      </p>
      {borrowable.length === 0 ? (
        <p className="text-slate-500">No puzzles available right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {borrowable.map((item) => (
            <PuzzleCard
              key={item.id}
              item={{ ...item, ownerName: item.owner?.name }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
