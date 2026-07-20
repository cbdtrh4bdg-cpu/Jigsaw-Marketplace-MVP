import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/pageAuth";
import { Badge, Card } from "@/components/ui";
import { ListingForm } from "@/components/ListingForm";
import { PuzzleCard } from "@/components/PuzzleCard";

export const dynamic = "force-dynamic";

export default async function MyListingsPage() {
  const user = await requireUserPage("/my-listings");
  const items = await prisma.inventoryItem.findMany({
    where: { ownerId: user.id },
    include: { catalogItem: true, rentals: { where: { status: { notIn: ["COMPLETED", "DECLINED", "CANCELED"] } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">My listings</h1>
        {items.length === 0 ? (
          <p className="text-slate-500">
            You haven&apos;t listed any puzzles yet. Add one on the right.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <PuzzleCard item={item} />
                <div className="flex items-center gap-2 px-1">
                  <Badge tone={item.status === "AVAILABLE" ? "green" : "amber"}>
                    {item.status}
                  </Badge>
                  {item.rentals.length > 0 ? (
                    <Badge tone="indigo">{item.rentals.length} active rental</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-semibold">List a puzzle</h2>
        <ListingForm />
      </Card>
    </div>
  );
}
