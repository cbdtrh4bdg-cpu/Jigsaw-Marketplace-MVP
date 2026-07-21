import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCategoryModule } from "@/lib/categories";
import { formatCents, titleCase } from "@/lib/format";
import { requireSession, getActiveSubscription } from "@/lib/permissions";
import { BorrowWidget } from "@/components/borrow-widget";

export const dynamic = "force-dynamic";

export default async function PuzzleDetailPage({
  params,
}: {
  params: { copyId: string };
}) {
  const user = await requireSession();
  const item = await prisma.inventoryItem.findUnique({
    where: { id: params.copyId },
    include: {
      catalogItem: true,
      owner: { select: { id: true, name: true } },
    },
  });
  if (!item) notFound();

  const sub = await getActiveSubscription(user.id);
  const isOwnListing = item.ownerId === user.id;
  const isAvailable = item.status === "AVAILABLE";
  let blockedReason: string | undefined;
  if (isOwnListing) blockedReason = "This is your own listing.";
  else if (!isAvailable) blockedReason = "This item is currently on loan.";
  else if (!sub) blockedReason = "subscription";
  const canBorrow = !blockedReason;

  const mod = getCategoryModule(item.catalogItem.category);
  const summary = mod.summarizeAttributes(
    item.catalogItem.attributes as Record<string, unknown>,
  );
  const isWarehouse = item.source === "WAREHOUSE";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/browse" className="text-sm text-brand-600 hover:underline">
        ← Back to browse
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
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

        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isWarehouse
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isWarehouse ? "Warehouse" : "Community"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {titleCase(item.status)}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {item.catalogItem.title}
          </h1>
          <p className="mt-1 text-slate-500">
            {item.catalogItem.brand ? `${item.catalogItem.brand} · ` : ""}
            {summary} · {mod.label}
          </p>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Rate</dt>
              <dd className="font-medium text-slate-900">
                {formatCents(item.ratePerWeekCents)} / week
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Refundable deposit</dt>
              <dd className="font-medium text-slate-900">
                {formatCents(item.depositCents)}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Condition</dt>
              <dd className="font-medium text-slate-900">{item.condition}</dd>
            </div>
            {item.owner && !isWarehouse && (
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Lent by</dt>
                <dd className="font-medium text-slate-900">{item.owner.name}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6">
            <BorrowWidget
              inventoryItemId={item.id}
              ratePerWeekCents={item.ratePerWeekCents}
              depositCents={item.depositCents}
              canBorrow={canBorrow}
              blockedReason={blockedReason}
              creditsAvailable={sub?.creditsRemaining ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
