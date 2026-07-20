import { supabaseAdmin } from "@/lib/supabase";
import { InventoryStatus, type RevenueShareEntryRow } from "@/lib/db-types";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { computeOwnerStanding } from "@/lib/services/revenueShareResolver";
import { platformFeeBpsForStanding } from "@/lib/services/revenueShare";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const db = supabaseAdmin();

  const { data: entryRows } = await db
    .from("RevenueShareEntry")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(100);
  const entries = (entryRows as RevenueShareEntryRow[] | null) ?? [];

  // Resolve titles + owner names for the ledger.
  const rentalIds = [...new Set(entries.map((e) => e.rentalId))];
  const ownerIds = [...new Set(entries.map((e) => e.ownerId).filter(Boolean))] as string[];
  const { data: rentalRows } = rentalIds.length
    ? await db.from("Rental").select("id, inventoryItemId").in("id", rentalIds)
    : { data: [] as { id: string; inventoryItemId: string }[] };
  const rentals = (rentalRows as { id: string; inventoryItemId: string }[]) ?? [];
  const invIds = [...new Set(rentals.map((r) => r.inventoryItemId))];
  const { data: invRows } = invIds.length
    ? await db.from("InventoryItem").select("id, catalogItemId").in("id", invIds)
    : { data: [] as { id: string; catalogItemId: string }[] };
  const inv = (invRows as { id: string; catalogItemId: string }[]) ?? [];
  const catIds = [...new Set(inv.map((i) => i.catalogItemId))];
  const { data: catRows } = catIds.length
    ? await db.from("CatalogItem").select("id, title").in("id", catIds)
    : { data: [] as { id: string; title: string }[] };
  const { data: ownerRows } = ownerIds.length
    ? await db.from("User").select("id, name").in("id", ownerIds)
    : { data: [] as { id: string; name: string | null }[] };

  const rentalById = new Map(rentals.map((r) => [r.id, r]));
  const invById = new Map(inv.map((i) => [i.id, i]));
  const catById = new Map(((catRows as { id: string; title: string }[]) ?? []).map((c) => [c.id, c]));
  const ownerById = new Map(
    ((ownerRows as { id: string; name: string | null }[]) ?? []).map((u) => [u.id, u]),
  );
  const titleFor = (rentalId: string) => {
    const r = rentalById.get(rentalId);
    const i = r ? invById.get(r.inventoryItemId) : undefined;
    return i ? (catById.get(i.catalogItemId)?.title ?? "—") : "—";
  };

  // Live per-owner standing summary for members who own USER inventory.
  const { data: ownerInvRows } = await db
    .from("InventoryItem")
    .select("ownerId")
    .eq("source", "USER")
    .not("ownerId", "is", null);
  const memberOwnerIds = [
    ...new Set(((ownerInvRows as { ownerId: string }[]) ?? []).map((r) => r.ownerId)),
  ];
  const { data: memberRows } = memberOwnerIds.length
    ? await db.from("User").select("id, name").in("id", memberOwnerIds)
    : { data: [] as { id: string; name: string | null }[] };
  const members = (memberRows as { id: string; name: string | null }[]) ?? [];

  const standings = await Promise.all(
    members.map(async (o) => {
      const standing = await computeOwnerStanding(o.id);
      const { data: distinct } = await db
        .from("InventoryItem")
        .select("catalogItemId")
        .eq("ownerId", o.id)
        .in("status", [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED]);
      const titles = new Set(((distinct as { catalogItemId: string }[]) ?? []).map((d) => d.catalogItemId));
      const { data: paidRows } = await db
        .from("RevenueShareEntry")
        .select("ownerPayoutCents")
        .eq("ownerId", o.id);
      const totalPaid = ((paidRows as { ownerPayoutCents: number }[]) ?? []).reduce(
        (s, r) => s + r.ownerPayoutCents,
        0,
      );
      return {
        name: o.name,
        standing,
        platformFeeBps: platformFeeBpsForStanding(standing),
        titles: titles.size,
        totalPaid,
      };
    }),
  );
  standings.sort((a, b) => b.standing - a.standing);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Owner standing & payouts</h1>
        <p className="mb-4 text-sm text-slate-500">
          Standing blends contribution (capped, anti-bloat) with real demand.
          A few in-demand titles out-rank a hoard of unwanted listings.
        </p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2 text-right">Distinct titles</th>
                <th className="px-4 py-2 text-right">Standing</th>
                <th className="px-4 py-2 text-right">Platform fee</th>
                <th className="px-4 py-2 text-right">Owner share</th>
                <th className="px-4 py-2 text-right">Total paid</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr key={s.name} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-right">{s.titles}</td>
                  <td className="px-4 py-2 text-right">{s.standing.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{s.platformFeeBps / 100}%</td>
                  <td className="px-4 py-2 text-right">
                    <Badge tone="green">{(10000 - s.platformFeeBps) / 100}%</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">{formatCents(s.totalPaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Payout ledger</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Puzzle</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2 text-right">Fee</th>
                <th className="px-4 py-2 text-right">Standing</th>
                <th className="px-4 py-2 text-right">Pop. bonus</th>
                <th className="px-4 py-2 text-right">Owner</th>
                <th className="px-4 py-2 text-right">Platform</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">{titleFor(e.rentalId)}</td>
                  <td className="px-4 py-2">
                    {e.ownerId ? (ownerById.get(e.ownerId)?.name ?? "—") : "Warehouse"}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCents(e.feeCents)}</td>
                  <td className="px-4 py-2 text-right">{e.ownerStanding.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">+{e.popularityBonusBps / 100}%</td>
                  <td className="px-4 py-2 text-right">{formatCents(e.ownerPayoutCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(e.platformCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No payouts recorded yet. Complete a rental to populate the ledger.
          </p>
        ) : null}
      </div>
    </div>
  );
}
