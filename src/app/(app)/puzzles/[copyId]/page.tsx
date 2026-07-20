import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/pageAuth";
import { hasActiveSubscription } from "@/lib/permissions";
import { getCategoryModule } from "@/lib/categories";
import { InventoryStatus, InventorySource } from "@prisma/client";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { RequestRentalForm } from "@/components/RequestRentalForm";
import { FavoriteButton } from "@/components/FavoriteButton";
import { getTitleSignals } from "@/lib/services/revenueShareResolver";
import { titlePopularity } from "@/lib/services/revenueShare";

export const dynamic = "force-dynamic";

export default async function PuzzleDetailPage({
  params,
}: {
  params: Promise<{ copyId: string }>;
}) {
  const { copyId } = await params;
  const user = await requireUserPage(`/puzzles/${copyId}`);

  const item = await prisma.inventoryItem.findUnique({
    where: { id: copyId },
    include: {
      catalogItem: { include: { reviews: { include: { user: true } } } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (!item) notFound();

  const mod = getCategoryModule(item.catalogItem.category);
  const attrs = mod.attributeSchema.safeParse(item.catalogItem.attributes);
  const [favorited, subscribed, signals] = await Promise.all([
    prisma.favorite.findUnique({
      where: {
        userId_catalogItemId: {
          userId: user.id,
          catalogItemId: item.catalogItemId,
        },
      },
    }),
    hasActiveSubscription(user.id),
    getTitleSignals(prisma, item.catalogItemId),
  ]);
  const popularity = Math.round(titlePopularity(signals));

  const isOwn = item.ownerId === user.id;
  const unavailable = item.status !== InventoryStatus.AVAILABLE;

  let disabledReason: string | undefined;
  if (isOwn) disabledReason = "This is your own listing.";
  else if (unavailable) disabledReason = "This copy is currently unavailable.";
  else if (!subscribed) disabledReason = "Subscribe to request a borrow.";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-4 flex aspect-[4/3] max-w-xl items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {item.catalogItem.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.catalogItem.imageUrl}
              alt={item.catalogItem.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-6xl">🧩</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{item.catalogItem.title}</h1>
          <Badge tone={item.source === InventorySource.WAREHOUSE ? "indigo" : "slate"}>
            {item.source === InventorySource.WAREHOUSE ? "Warehouse" : "Member"}
          </Badge>
        </div>
        {item.catalogItem.brand ? (
          <p className="text-slate-500">{item.catalogItem.brand}</p>
        ) : null}
        <p className="mt-2 text-slate-700">
          {attrs.success ? mod.summarize(attrs.data as never) : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Badge tone="amber">Popularity {popularity}/100</Badge>
          <span>· {signals.completedRentals} completed rentals</span>
          <span>· {signals.favorites} wishlisted</span>
          {signals.avgRating > 0 ? (
            <span>· ★ {signals.avgRating.toFixed(1)}</span>
          ) : null}
        </div>
        {item.condition ? (
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-medium">Condition:</span> {item.condition}
          </p>
        ) : null}
        {item.owner?.name ? (
          <p className="mt-1 text-sm text-slate-500">Owned by {item.owner.name}</p>
        ) : null}

        <div className="mt-4">
          <FavoriteButton
            catalogItemId={item.catalogItemId}
            initialFavorited={Boolean(favorited)}
          />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
          {item.catalogItem.reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {item.catalogItem.reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium">
                    {"★".repeat(r.rating)}
                    <span className="text-slate-300">
                      {"★".repeat(5 - r.rating)}
                    </span>{" "}
                    <span className="text-slate-500">— {r.user.name}</span>
                  </p>
                  {r.comment ? (
                    <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Card className="h-fit">
        <p className="text-2xl font-bold">
          {formatCents(item.ratePerWeekCents)}
          <span className="text-sm font-normal text-slate-500"> / week</span>
        </p>
        <div className="mt-4">
          <RequestRentalForm
            inventoryItemId={item.id}
            ratePerWeekCents={item.ratePerWeekCents}
            depositCents={item.depositCents}
            disabled={Boolean(disabledReason)}
            disabledReason={disabledReason}
          />
        </div>
      </Card>
    </div>
  );
}
