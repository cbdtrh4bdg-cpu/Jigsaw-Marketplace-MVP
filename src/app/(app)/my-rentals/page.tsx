import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/pageAuth";
import { rentalViewInclude, serializeRental } from "@/lib/serializeRental";
import { RentalActions } from "@/components/rental/RentalActions";

export const dynamic = "force-dynamic";

export default async function MyRentalsPage() {
  const user = await requireUserPage("/my-rentals");
  const rentals = await prisma.rental.findMany({
    where: { borrowerId: user.id },
    include: rentalViewInclude,
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">My rentals</h1>
      <p className="mb-6 text-sm text-slate-500">
        Puzzles you&apos;ve requested or borrowed.
      </p>
      {rentals.length === 0 ? (
        <p className="text-slate-500">
          You haven&apos;t requested any rentals yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rentals.map((r) => (
            <RentalActions
              key={r.id}
              rental={serializeRental(r, "borrower")}
              perspective="borrower"
            />
          ))}
        </div>
      )}
    </div>
  );
}
