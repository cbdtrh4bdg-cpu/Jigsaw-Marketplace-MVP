import { supabaseAdmin } from "@/lib/supabase";
import {
  InventoryStatus,
  PayerRole,
  RentalStatus,
  Role,
  ShipmentDirection,
} from "@/lib/db-types";
import { SHIPPING_POLICY, isValidPeriod } from "@/lib/config";
import { applyCredits, computeDueAt, quoteRentalFeeCents } from "./pricing";
import { assertTransition } from "./rentalStateMachine";
import { getShippingProvider } from "./shipping";
import { resolveRevenueShare } from "./revenueShareResolver";
import {
  getFullRental,
  getInventoryItem,
  type FullRental,
} from "@/lib/data";

export class RentalError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "RentalError";
  }
}

type ActingUser = { id: string; role: Role };

function db() {
  return supabaseAdmin();
}

async function loadRental(id: string): Promise<FullRental> {
  const rental = await getFullRental(id);
  if (!rental) throw new RentalError("Rental not found", 404);
  return rental;
}

function isOwnerOrAdmin(rental: FullRental, user: ActingUser): boolean {
  if (user.role === Role.ADMIN) return true;
  return rental.inventoryItem.ownerId === user.id;
}

function payerFor(role: PayerRole, rental: FullRental): string | null {
  switch (role) {
    case PayerRole.BORROWER:
      return rental.borrowerId;
    case PayerRole.LENDER:
      return rental.inventoryItem.ownerId;
    case PayerRole.PLATFORM:
      return null;
  }
}

// Call an RPC and translate known plpgsql exceptions into RentalErrors.
async function rpc(name: string, args: Record<string, unknown>) {
  const { error } = await db().rpc(name, args);
  if (!error) return;
  if (error.message.includes("missing_condition_proof")) {
    throw new RentalError("Upload the completion photo before shipping the return");
  }
  if (error.message.includes("rental_not_in_expected_state")) {
    throw new RentalError("This rental changed state; refresh and try again", 409);
  }
  throw new Error(`RPC ${name} failed: ${error.message}`);
}

// --- Request --------------------------------------------------------------

export async function requestRental(input: {
  inventoryItemId: string;
  borrowerId: string;
  periodDays: number;
}) {
  if (!isValidPeriod(input.periodDays)) {
    throw new RentalError(`Invalid rental period: ${input.periodDays} days`);
  }
  const item = await getInventoryItem(input.inventoryItemId);
  if (!item) throw new RentalError("Inventory item not found", 404);
  if (item.status !== InventoryStatus.AVAILABLE) {
    throw new RentalError("This copy is not currently available");
  }
  if (item.ownerId === input.borrowerId) {
    throw new RentalError("You cannot borrow your own listing");
  }

  const { data, error } = await db()
    .from("Rental")
    .insert({
      inventoryItemId: item.id,
      borrowerId: input.borrowerId,
      periodDays: input.periodDays,
      status: RentalStatus.REQUESTED,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Rental insert failed: ${error.message}`);
  return loadRental((data as { id: string }).id);
}

// --- Approve / Decline / Cancel ------------------------------------------

export async function approveRental(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can approve this request", 403);
  }
  assertTransition(rental.status, RentalStatus.APPROVED);

  const now = new Date();
  const quotedFeeCents = quoteRentalFeeCents(
    rental.inventoryItem.ratePerWeekCents,
    rental.periodDays,
  );

  // Apply subscription credits, then charge the remaining fee.
  const { data: subRow } = await db()
    .from("Subscription")
    .select("creditsRemaining")
    .eq("userId", rental.borrowerId)
    .maybeSingle();
  const credits = (subRow as { creditsRemaining: number } | null)?.creditsRemaining ?? 0;
  const { chargeCents, creditsApplied } = applyCredits(quotedFeeCents, credits);

  await rpc("approve_rental", {
    p_rental_id: rental.id,
    p_borrower_id: rental.borrowerId,
    p_quoted_fee: quotedFeeCents,
    p_credits_applied: creditsApplied,
    p_charge_cents: chargeCents,
    p_deposit_cents: rental.inventoryItem.depositCents,
    p_due_at: computeDueAt(now, rental.periodDays).toISOString(),
  });
  return loadRental(rental.id);
}

export async function declineRental(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can decline this request", 403);
  }
  assertTransition(rental.status, RentalStatus.DECLINED);
  await rpc("decline_rental", { p_rental_id: rental.id });
  return loadRental(rental.id);
}

export async function cancelRental(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  const isBorrower = rental.borrowerId === user.id;
  if (!isBorrower && !isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Not authorized to cancel this rental", 403);
  }
  assertTransition(rental.status, RentalStatus.CANCELED);
  await rpc("cancel_rental", { p_rental_id: rental.id });
  return loadRental(rental.id);
}

// --- Shipping legs --------------------------------------------------------

export async function shipToBorrower(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can mark this shipped", 403);
  }
  assertTransition(rental.status, RentalStatus.SHIPPED_TO_BORROWER);
  const label = await getShippingProvider().buyLabel(ShipmentDirection.OUTBOUND);
  await rpc("ship_to_borrower", {
    p_rental_id: rental.id,
    p_cost: label.costCents,
    p_tracking: label.trackingCode,
    p_paid_by_role: SHIPPING_POLICY.outboundPaidBy,
    p_paid_by_user: payerFor(SHIPPING_POLICY.outboundPaidBy, rental),
  });
  return loadRental(rental.id);
}

export async function receiveByBorrower(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can confirm receipt", 403);
  }
  assertTransition(rental.status, RentalStatus.IN_HAND);
  await rpc("receive_by_borrower", { p_rental_id: rental.id });
  return loadRental(rental.id);
}

export async function returnShip(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can ship the return", 403);
  }
  if (!rental.conditionProof) {
    throw new RentalError("Upload the completion photo before shipping the return");
  }
  assertTransition(rental.status, RentalStatus.RETURN_SHIPPED);
  const label = await getShippingProvider().buyLabel(ShipmentDirection.RETURN);
  await rpc("return_ship", {
    p_rental_id: rental.id,
    p_cost: label.costCents,
    p_tracking: label.trackingCode,
    p_paid_by_role: SHIPPING_POLICY.returnPaidBy,
    p_paid_by_user: payerFor(SHIPPING_POLICY.returnPaidBy, rental),
  });
  return loadRental(rental.id);
}

export async function markReturned(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can confirm the return", 403);
  }
  assertTransition(rental.status, RentalStatus.RETURNED);
  await rpc("mark_returned", { p_rental_id: rental.id });
  return loadRental(rental.id);
}

// --- Condition proof + survey --------------------------------------------

export async function uploadConditionProof(
  rentalId: string,
  user: ActingUser,
  input: { imageUrl: string; note?: string },
) {
  const rental = await loadRental(rentalId);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can upload the proof", 403);
  }
  if (rental.status !== RentalStatus.IN_HAND) {
    throw new RentalError("Proof can only be uploaded while the copy is in hand");
  }
  const { data, error } = await db()
    .from("ConditionProof")
    .upsert(
      { rentalId, imageUrl: input.imageUrl, note: input.note ?? null },
      { onConflict: "rentalId" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Proof upsert failed: ${error.message}`);
  return data;
}

export async function submitExperience(
  rentalId: string,
  user: ActingUser,
  input: {
    timeToCompleteHours?: number;
    difficultyRating?: number;
    enjoymentRating?: number;
    missingPiecesReported?: number;
    notes?: string;
  },
) {
  const rental = await loadRental(rentalId);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can submit the survey", 403);
  }
  const { data, error } = await db()
    .from("RentalExperience")
    .upsert(
      {
        rentalId,
        timeToCompleteHours: input.timeToCompleteHours ?? null,
        difficultyRating: input.difficultyRating ?? null,
        enjoymentRating: input.enjoymentRating ?? null,
        missingPiecesReported: input.missingPiecesReported ?? 0,
        notes: input.notes ?? null,
      },
      { onConflict: "rentalId" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`Survey upsert failed: ${error.message}`);
  return data;
}

// --- Inspection: complete or dispute -------------------------------------

export async function inspectComplete(rentalId: string, user: ActingUser) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can complete this rental", 403);
  }
  assertTransition(rental.status, RentalStatus.COMPLETED);
  const split = await resolveRevenueShare(rental.id);
  await rpc("complete_rental", {
    p_rental_id: rental.id,
    p_expected_status: RentalStatus.RETURNED,
    p_forfeit_cents: 0,
    p_owner_id: split.ownerId,
    p_fee: split.feeCents,
    p_owner_standing: split.ownerStanding,
    p_platform_bps: split.platformFeeBps,
    p_bonus_bps: split.popularityBonusBps,
    p_owner_payout: split.ownerPayoutCents,
    p_platform_cents: split.platformCents,
    p_resolution: null,
  });
  return loadRental(rental.id);
}

export async function openDispute(
  rentalId: string,
  user: ActingUser,
  input: { reason: string },
) {
  const rental = await loadRental(rentalId);
  if (!isOwnerOrAdmin(rental, user)) {
    throw new RentalError("Only the owner can open a dispute", 403);
  }
  assertTransition(rental.status, RentalStatus.DISPUTED);
  await rpc("open_dispute", {
    p_rental_id: rental.id,
    p_opened_by: user.id,
    p_reason: input.reason,
  });
  return loadRental(rental.id);
}

export async function resolveDispute(
  rentalId: string,
  user: ActingUser,
  input: { resolution: string; forfeitCents: number },
) {
  if (user.role !== Role.ADMIN) {
    throw new RentalError("Only an admin can resolve disputes", 403);
  }
  const rental = await loadRental(rentalId);
  assertTransition(rental.status, RentalStatus.COMPLETED);
  const forfeit = Math.max(
    0,
    Math.min(input.forfeitCents, rental.deposit?.amountCents ?? 0),
  );
  const split = await resolveRevenueShare(rental.id);
  await rpc("complete_rental", {
    p_rental_id: rental.id,
    p_expected_status: RentalStatus.DISPUTED,
    p_forfeit_cents: forfeit,
    p_owner_id: split.ownerId,
    p_fee: split.feeCents,
    p_owner_standing: split.ownerStanding,
    p_platform_bps: split.platformFeeBps,
    p_bonus_bps: split.popularityBonusBps,
    p_owner_payout: split.ownerPayoutCents,
    p_platform_cents: split.platformCents,
    p_resolution: input.resolution,
  });
  return loadRental(rental.id);
}
