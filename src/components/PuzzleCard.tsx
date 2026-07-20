import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { getCategoryModule } from "@/lib/categories";
import { Category, InventorySource } from "@prisma/client";

export interface PuzzleCardData {
  id: string;
  source: InventorySource;
  ratePerWeekCents: number;
  depositCents: number;
  catalogItem: {
    category: Category;
    title: string;
    brand: string | null;
    imageUrl: string | null;
    attributes: unknown;
  };
  ownerName?: string | null;
}

export function PuzzleCard({ item }: { item: PuzzleCardData }) {
  const mod = getCategoryModule(item.catalogItem.category);
  const summary = safeSummary(mod, item.catalogItem.attributes);

  return (
    <Link href={`/puzzles/${item.id}`}>
      <Card className="h-full transition hover:shadow-md">
        <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-slate-100">
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{item.catalogItem.title}</h3>
          <Badge tone={item.source === InventorySource.WAREHOUSE ? "indigo" : "slate"}>
            {item.source === InventorySource.WAREHOUSE ? "Warehouse" : "Member"}
          </Badge>
        </div>
        {item.catalogItem.brand ? (
          <p className="text-xs text-slate-500">{item.catalogItem.brand}</p>
        ) : null}
        <p className="mt-1 text-sm text-slate-600">{summary}</p>
        <p className="mt-3 text-sm">
          <span className="font-semibold">{formatCents(item.ratePerWeekCents)}</span>
          <span className="text-slate-500"> / week</span>
        </p>
      </Card>
    </Link>
  );
}

function safeSummary(
  mod: ReturnType<typeof getCategoryModule>,
  attributes: unknown,
): string {
  const parsed = mod.attributeSchema.safeParse(attributes);
  return parsed.success ? mod.summarize(parsed.data as never) : "";
}
