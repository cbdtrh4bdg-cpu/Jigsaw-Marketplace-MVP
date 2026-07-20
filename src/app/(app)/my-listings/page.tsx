import { requireUserPage } from "@/lib/pageAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { listInventoryWithCatalog } from "@/lib/data";
import { Badge, Card } from "@/components/ui";
import { ListingForm } from "@/components/ListingForm";
import { PuzzleCard } from "@/components/PuzzleCard";

export const dynamic = "force-dynamic";

export default async function MyListingsPage() {
  const user = await requireUserPage("/my-listings");
  const items = await listInventoryWithCatalog({ ownerId: user.id });

  // Count active rentals per copy (not completed/declined/canceled).
  const activeByItem = new Map<string, number>();
  if (items.length > 0) {
    const { data } = await supabaseAdmin()
      .from("Rental")
      .select("inventoryItemId, status")
      .in("inventoryItemId", items.map((i) => i.id));
    for (const r of (data as { inventoryItemId: string; status: string }[] | null) ?? []) {
      if (["COMPLETED", "DECLINED", "CANCELED"].includes(r.status)) continue;
      activeByItem.set(r.inventoryItemId, (activeByItem.get(r.inventoryItemId) ?? 0) + 1);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">My listings</h1>
        {items.length === 0 ? (
          <p className="text-slate-500">
            You haven&apos;t listed any puzzles yet. Add one on the right.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const active = activeByItem.get(item.id) ?? 0;
              return (
                <div key={item.id} className="space-y-1">
                  <PuzzleCard item={item} />
                  <div className="flex items-center gap-2 px-1">
                    <Badge tone={item.status === "AVAILABLE" ? "green" : "amber"}>
                      {item.status}
                    </Badge>
                    {active > 0 ? (
                      <Badge tone="indigo">{active} active rental</Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-semibold">List a puzzle</h2>
        <ListingForm />
      </Card>
    </div>
  );
}
