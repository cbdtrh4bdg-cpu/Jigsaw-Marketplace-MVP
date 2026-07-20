import { supabaseAdmin } from "@/lib/supabase";
import type { RentalRow } from "@/lib/db-types";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminRentalsPage() {
  const db = supabaseAdmin();
  const { data: rentalRows } = await db
    .from("Rental")
    .select("*")
    .order("requestedAt", { ascending: false })
    .limit(100);
  const rentals = (rentalRows as RentalRow[] | null) ?? [];

  // Batch-load titles + borrowers.
  const invIds = [...new Set(rentals.map((r) => r.inventoryItemId))];
  const borrowerIds = [...new Set(rentals.map((r) => r.borrowerId))];
  const [{ data: invRows }, { data: userRows }] = await Promise.all([
    invIds.length
      ? db.from("InventoryItem").select("id, catalogItemId").in("id", invIds)
      : Promise.resolve({ data: [] as { id: string; catalogItemId: string }[] }),
    borrowerIds.length
      ? db.from("User").select("id, name").in("id", borrowerIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
  ]);
  const inv = (invRows as { id: string; catalogItemId: string }[]) ?? [];
  const catalogIds = [...new Set(inv.map((i) => i.catalogItemId))];
  const { data: catRows } = catalogIds.length
    ? await db.from("CatalogItem").select("id, title").in("id", catalogIds)
    : { data: [] as { id: string; title: string }[] };

  const invById = new Map(inv.map((i) => [i.id, i]));
  const catById = new Map(((catRows as { id: string; title: string }[]) ?? []).map((c) => [c.id, c]));
  const userById = new Map(
    ((userRows as { id: string; name: string | null }[]) ?? []).map((u) => [u.id, u]),
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">All rentals</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Puzzle</th>
              <th className="px-4 py-2">Borrower</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2 text-right">Fee</th>
              <th className="px-4 py-2">Requested</th>
            </tr>
          </thead>
          <tbody>
            {rentals.map((r) => {
              const inv = invById.get(r.inventoryItemId);
              const title = inv ? catById.get(inv.catalogItemId)?.title : undefined;
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">{title ?? "—"}</td>
                  <td className="px-4 py-2">{userById.get(r.borrowerId)?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge>{r.status.replaceAll("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-2">{r.periodDays / 7}wk</td>
                  <td className="px-4 py-2 text-right">{formatCents(r.quotedFeeCents)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(r.requestedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
