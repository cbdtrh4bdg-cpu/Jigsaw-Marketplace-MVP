import { InventorySource } from "@/lib/db-types";
import { listInventoryWithCatalog } from "@/lib/data";
import { Badge, Card } from "@/components/ui";
import { ListingForm } from "@/components/ListingForm";
import { PuzzleCard } from "@/components/PuzzleCard";

export const dynamic = "force-dynamic";

export default async function AdminWarehousePage() {
  const items = await listInventoryWithCatalog({
    source: InventorySource.WAREHOUSE,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Warehouse inventory</h1>
        <p className="mb-4 text-sm text-slate-500">
          Platform-owned copies (no member owner). These appear in Browse
          alongside member listings and keep 100% of the rental fee.
        </p>
        {items.length === 0 ? (
          <p className="text-slate-500">No warehouse inventory yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <PuzzleCard item={item} />
                <Badge tone={item.status === "AVAILABLE" ? "green" : "amber"}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-semibold">Add warehouse copy</h2>
        <ListingForm
          endpoint="/api/admin/warehouse"
          submitLabel="Add to warehouse"
        />
      </Card>
    </div>
  );
}
