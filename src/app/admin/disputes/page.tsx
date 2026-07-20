import { prisma } from "@/lib/db";
import { RentalStatus } from "@prisma/client";
import { rentalViewInclude, serializeRental } from "@/lib/serializeRental";
import { RentalActions } from "@/components/rental/RentalActions";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const rentals = await prisma.rental.findMany({
    where: { status: RentalStatus.DISPUTED },
    include: rentalViewInclude,
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Open disputes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Review the completion photo and the borrower&apos;s missing-piece report,
        then decide how much of the deposit is forfeited.
      </p>
      {rentals.length === 0 ? (
        <p className="text-slate-500">No open disputes. 🎉</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rentals.map((r) => (
            <RentalActions
              key={r.id}
              rental={serializeRental(r, "lender")}
              perspective="lender"
              isAdmin
            />
          ))}
        </div>
      )}
    </div>
  );
}
