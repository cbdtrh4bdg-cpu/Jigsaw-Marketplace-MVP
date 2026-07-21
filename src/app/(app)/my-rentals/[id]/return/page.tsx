import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { getCategoryModule } from "@/lib/categories";
import { ReturnForm } from "./return-form";

export const dynamic = "force-dynamic";

export default async function ReturnPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireSession();
  const rental = await prisma.rental.findUnique({
    where: { id: params.id },
    include: { inventoryItem: { include: { catalogItem: true } } },
  });
  if (!rental || rental.borrowerId !== user.id) notFound();
  // Only borrowers holding the item can complete & return it.
  if (rental.status !== "IN_HAND") redirect("/my-rentals");

  const mod = getCategoryModule(rental.inventoryItem.catalogItem.category);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/my-rentals" className="text-sm text-brand-600 hover:underline">
        ← Back to my rentals
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Complete &amp; return: {rental.inventoryItem.catalogItem.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload proof the item is complete and tell us about your experience.
        Once you submit, we&apos;ll generate a return shipping label.
      </p>

      <ReturnForm
        rentalId={rental.id}
        proofPrompt={mod.conditionProofPrompt}
        timeLabel={mod.completionTimeLabel}
      />
    </div>
  );
}
