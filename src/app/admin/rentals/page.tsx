import { prisma } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminRentalsPage() {
  const rentals = await prisma.rental.findMany({
    include: {
      inventoryItem: { include: { catalogItem: true } },
      borrower: true,
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

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
            {rentals.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2">{r.inventoryItem.catalogItem.title}</td>
                <td className="px-4 py-2">{r.borrower.name}</td>
                <td className="px-4 py-2">
                  <Badge>{r.status.replaceAll("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2">{r.periodDays / 7}wk</td>
                <td className="px-4 py-2 text-right">
                  {formatCents(r.quotedFeeCents)}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {r.requestedAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
