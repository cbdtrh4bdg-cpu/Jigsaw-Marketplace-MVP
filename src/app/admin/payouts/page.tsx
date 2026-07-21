import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const entries = await prisma.revenueShareEntry.findMany({
    include: {
      rental: {
        include: { inventoryItem: { include: { catalogItem: true, owner: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = entries.reduce(
    (acc, e) => {
      acc.gross += e.grossRentalFeeCents;
      acc.platform += e.platformFeeCents;
      acc.owner += e.ownerPayoutCents;
      return acc;
    },
    { gross: 0, platform: 0, owner: 0 },
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Revenue-share ledger</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every completed rental&apos;s split, with the owner standing and tier
        locked in at completion.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat label="Gross fees" value={totals.gross} />
        <Stat label="Platform fees" value={totals.platform} />
        <Stat label="Owner payouts" value={totals.owner} />
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No completed rentals yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Standing</th>
                <th className="px-4 py-3 font-medium">Platform %</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Bonus</th>
                <th className="px-4 py-3 font-medium">Owner payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {e.rental.inventoryItem.catalogItem.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.rental.inventoryItem.owner?.name ?? (
                      <span className="text-amber-600">Warehouse</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.ownerStanding.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.platformFeePct}%</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatCents(e.grossRentalFeeCents)}
                  </td>
                  <td className="px-4 py-3 text-emerald-600">
                    {e.popularityBonusCents > 0
                      ? `+${formatCents(e.popularityBonusCents)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatCents(e.ownerPayoutCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{formatCents(value)}</p>
    </div>
  );
}
