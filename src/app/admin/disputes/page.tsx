import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { ResolveDisputeForm } from "./resolve-form";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const disputes = await prisma.dispute.findMany({
    where: { status: "OPEN" },
    include: {
      rental: {
        include: {
          deposit: true,
          borrower: { select: { name: true } },
          inventoryItem: {
            include: {
              catalogItem: true,
              owner: { select: { name: true } },
            },
          },
          experience: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Open disputes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Review the return, then refund or forfeit part/all of the deposit.
        Forfeited amounts go to the owner (community) or the platform (warehouse).
      </p>

      {disputes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No open disputes. 🎉
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {disputes.map((d) => {
            const r = d.rental;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {r.inventoryItem.catalogItem.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Borrower {r.borrower.name} ·{" "}
                      {r.inventoryItem.owner
                        ? `Owner ${r.inventoryItem.owner.name}`
                        : "Warehouse copy"}{" "}
                      · Deposit {formatCents(r.deposit?.amountCents ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  {d.reason}
                </div>

                {r.experience && (
                  <p className="mt-2 text-sm text-slate-600">
                    Borrower reported{" "}
                    <strong>{r.experience.missingPiecesReported}</strong> missing
                    piece(s)
                    {r.experience.notes ? ` — “${r.experience.notes}”` : ""}.
                  </p>
                )}

                <ResolveDisputeForm
                  rentalId={r.id}
                  depositCents={r.deposit?.amountCents ?? 0}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
