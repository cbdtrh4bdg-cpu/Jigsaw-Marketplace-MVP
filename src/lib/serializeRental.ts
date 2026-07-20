import { ShipmentDirection } from "@/lib/db-types";
import type { FullRental } from "@/lib/data";
import type { RentalView } from "@/components/rental/types";

export function serializeRental(
  r: FullRental,
  perspective: "borrower" | "lender",
): RentalView {
  const outbound = r.shipments.find((s) => s.direction === ShipmentDirection.OUTBOUND);
  const ret = r.shipments.find((s) => s.direction === ShipmentDirection.RETURN);
  return {
    id: r.id,
    status: r.status,
    periodDays: r.periodDays,
    quotedFeeCents: r.quotedFeeCents,
    dueAt: r.dueAt,
    title: r.inventoryItem.catalogItem.title,
    imageUrl: r.inventoryItem.catalogItem.imageUrl,
    category: r.inventoryItem.catalogItem.category,
    otherPartyName:
      perspective === "borrower"
        ? (r.inventoryItem.owner?.name ?? "Warehouse")
        : r.borrower.name,
    depositAmountCents: r.deposit?.amountCents ?? null,
    depositStatus: r.deposit?.status ?? null,
    hasProof: Boolean(r.conditionProof),
    proofImageUrl: r.conditionProof?.imageUrl ?? null,
    proofNote: r.conditionProof?.note ?? null,
    hasExperience: Boolean(r.experience),
    missingPiecesReported: r.experience?.missingPiecesReported ?? null,
    disputeReason: r.dispute?.reason ?? null,
    outboundShipCents: outbound?.costCents ?? null,
    returnShipCents: ret?.costCents ?? null,
  };
}
