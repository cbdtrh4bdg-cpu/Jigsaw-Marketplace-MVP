import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { formatCents } from "@/lib/format";
import { RentalStatusBadge } from "@/components/rental-status-badge";
import { RentalActionButton } from "@/components/rental-actions";

export const dynamic = "force-dynamic";

export default async function MyRentalsPage() {
  const user = await requireSession();
  const rentals = await prisma.rental.findMany({
    where: { borrowerId: user.id },
    include: { inventoryItem: { include: { catalogItem: true } } },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">My rentals</h1>
      <p className="mt-1 text-sm text-slate-500">
        Puzzles you&apos;ve requested or borrowed.
      </p>

      {rentals.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">
            You haven&apos;t borrowed anything yet.{" "}
            <Link href="/browse" className="font-medium text-brand-600 hover:underline">
              Browse the library.
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Puzzle</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rentals.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/puzzles/${r.inventoryItemId}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {r.inventoryItem.catalogItem.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.periodDays / 7} week{r.periodDays === 7 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.usedCredit ? (
                      <span className="text-emerald-600">Credit</span>
                    ) : (
                      formatCents(r.quotedFeeCents)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RentalStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.dueAt ? r.dueAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "REQUESTED" && (
                      <RentalActionButton rentalId={r.id} action="cancel" />
                    )}
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
