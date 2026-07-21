import Link from "next/link";
import { getCategoryModule } from "@/lib/categories";
import { formatCents } from "@/lib/format";
import type { BrowseItem } from "@/lib/services/catalog";

export function ItemCard({
  item,
  href,
}: {
  item: BrowseItem;
  href?: string;
}) {
  const mod = getCategoryModule(item.catalogItem.category);
  const summary = mod.summarizeAttributes(
    item.catalogItem.attributes as Record<string, unknown>,
  );
  const isWarehouse = item.source === "WAREHOUSE";

  const card = (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
        {item.catalogItem.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.catalogItem.imageUrl}
            alt={item.catalogItem.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl">🧩</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-slate-900">
            {item.catalogItem.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              isWarehouse
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isWarehouse ? "Warehouse" : "Community"}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {item.catalogItem.brand ? `${item.catalogItem.brand} · ` : ""}
          {summary}
        </p>
        <div className="mt-auto pt-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {formatCents(item.ratePerWeekCents)}
            </span>{" "}
            / week
          </p>
          <p className="text-xs text-slate-400">
            {formatCents(item.depositCents)} refundable deposit ·{" "}
            {item.condition}
          </p>
          {item.owner && !isWarehouse && (
            <p className="mt-1 text-xs text-slate-400">
              Lent by {item.owner.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
