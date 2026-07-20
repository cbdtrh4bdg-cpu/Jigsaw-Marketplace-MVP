import type { DepositStatus, RentalStatus } from "@/lib/db-types";

// A trimmed, serializable view of a rental for the management UI.
export interface RentalView {
  id: string;
  status: RentalStatus;
  periodDays: number;
  quotedFeeCents: number;
  dueAt: string | null;
  title: string;
  imageUrl: string | null;
  category: string;
  otherPartyName: string | null; // borrower name (lender view) or owner name (borrower view)
  depositAmountCents: number | null;
  depositStatus: DepositStatus | null;
  hasProof: boolean;
  proofImageUrl: string | null;
  proofNote: string | null;
  hasExperience: boolean;
  missingPiecesReported: number | null;
  disputeReason: string | null;
  outboundShipCents: number | null;
  returnShipCents: number | null;
}

export type Perspective = "borrower" | "lender";
