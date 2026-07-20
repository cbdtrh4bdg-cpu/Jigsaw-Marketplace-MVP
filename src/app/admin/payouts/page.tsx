import { prisma } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { computeOwnerStanding } from "@/lib/services/revenueShareResolver";
import { platformFeeBpsForStanding } from "@/lib/services/revenueShare";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const entries = await prisma.revenueShareEntry.findMany({
    include: {
      owner: true,
      rental: { include: { inventoryItem: { include: { catalogItem: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Current standing per member owner (live, for the summary).
  const owners = await prisma.user.findMany({
    where: { inventory: { some: { source: "USER" } } },
    select: { id: true, name: true },
  });
  const standings = await Promise.all(
    owners.map(async (o) => {
      const standing = await computeOwnerStanding(prisma, o.id);
      const distinctTitles = await prisma.inventoryItem.findMany({
        where: { ownerId: o.id, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: { catalogItemId: true },
        distinct: ["catalogItemId"],
      });
      const paidAgg = await prisma.revenueShareEntry.aggregate({
        where: { ownerId: o.id },
        _sum: { ownerPayoutCents: true },
      });
      return {
        name: o.name,
        standing,
        platformFeeBps: platformFeeBpsForStanding(standing),
        titles: distinctTitles.length,
        totalPaid: paidAgg._sum.ownerPayoutCents ?? 0,
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
                  <td className="px-4 py-2">
                    {e.rental.inventoryItem.catalogItem.title}
                  </td>
                  <td className="px-4 py-2">{e.owner?.name ?? "Warehouse"}</td>
                  <td className="px-4 py-2 text-right">{formatCents(e.feeCents)}</td>
                  <td className="px-4 py-2 text-right">{e.ownerStanding.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">+{e.popularityBonusBps / 100}%</td>
                  <td className="px-4 py-2 text-right">
                    {formatCents(e.ownerPayoutCents)}
                  </td>
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
