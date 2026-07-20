import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/pageAuth";
import { rentalViewInclude, serializeRental } from "@/lib/serializeRental";
import { RentalActions } from "@/components/rental/RentalActions";

export const dynamic = "force-dynamic";

export default async function MyLoansPage() {
  const user = await requireUserPage("/my-loans");
  // Rentals of copies this user owns (their listings being borrowed).
  const rentals = await prisma.rental.findMany({
    where: { inventoryItem: { ownerId: user.id } },
    include: rentalViewInclude,
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">My loans</h1>
      <p className="mb-6 text-sm text-slate-500">
        Requests and rentals of the puzzles you lend out.
      </p>
      {rentals.length === 0 ? (
        <p className="text-slate-500">No one has requested your puzzles yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rentals.map((r) => (
            <RentalActions
              key={r.id}
              rental={serializeRental(r, "lender")}
              perspective="lender"
            />
          ))}
        </div>
      )}
    </div>
  );
}
