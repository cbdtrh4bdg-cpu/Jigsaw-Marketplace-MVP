import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { formatCents } from "@/lib/format";
import { RentalStatusBadge } from "@/components/rental-status-badge";
import { RentalActionButton } from "@/components/rental-actions";

export const dynamic = "force-dynamic";

export default async function MyLoansPage() {
  const user = await requireSession();
  // Rentals against inventory this user owns (incoming borrow requests).
  const rentals = await prisma.rental.findMany({
    where: { inventoryItem: { ownerId: user.id } },
    include: {
      inventoryItem: { include: { catalogItem: true } },
      borrower: { select: { name: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">My loans</h1>
      <p className="mt-1 text-sm text-slate-500">
        Borrow requests and active loans for puzzles you own.
      </p>

      {rentals.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">No requests yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Puzzle</th>
                <th className="px-4 py-3 font-medium">Borrower</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rentals.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.inventoryItem.catalogItem.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.borrower.name}</td>
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
                  <td className="px-4 py-3">
                    {r.status === "REQUESTED" && (
                      <div className="flex justify-end gap-2">
                        <RentalActionButton rentalId={r.id} action="approve" />
                        <RentalActionButton rentalId={r.id} action="decline" />
                      </div>
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
