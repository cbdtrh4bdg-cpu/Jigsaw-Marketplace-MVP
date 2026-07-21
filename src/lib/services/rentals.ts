import type { RentalStatus, ShipmentDirection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/services/payments";
import { quoteRentalFeeCents, isAllowedPeriod } from "@/lib/services/pricing";
import { getShippingProvider, resolveShippingPayer } from "@/lib/services/shipping";
import { settleRevenueShare } from "@/lib/services/revenueShare";
import { getActiveSubscription } from "@/lib/permissions";

export class RentalError extends Error {}

// Load a rental with the relations most transitions need.
function rentalWithItem(rentalId: string) {
  return prisma.rental.findUnique({
    where: { id: rentalId },
    include: { inventoryItem: { include: { catalogItem: true } } },
  });
}

function isOwnerOrWarehouseAdmin(
  item: { ownerId: string | null },
  actorId: string,
  actorIsAdmin: boolean,
) {
  const isOwner = item.ownerId && item.ownerId === actorId;
  const isWarehouseAdmin = !item.ownerId && actorIsAdmin;
  return Boolean(isOwner || isWarehouseAdmin);
}

// Create a simulated shipment for one leg and charge the policy's payer.
async function createShipmentAndCharge(params: {
  rentalId: string;
  direction: ShipmentDirection;
  borrowerId: string;
  ownerId: string | null;
  pieceHint: number;
}) {
  const { rentalId, direction, borrowerId, ownerId, pieceHint } = params;
  const label = getShippingProvider().createLabel(direction, pieceHint);
  const payerId = resolveShippingPayer(direction, borrowerId, ownerId);

  const shipment = await prisma.shipment.create({
    data: {
      rentalId,
      direction,
      trackingNumber: label.trackingNumber,
      costCents: label.costCents,
      labelUrlStub: label.labelUrlStub,
      paidByUserId: payerId ?? "PLATFORM",
      status: "IN_TRANSIT",
    },
  });

  if (payerId) {
    await getPaymentProvider().chargeShipping(payerId, rentalId, label.costCents);
  }
  return shipment;
}

function pieceHintOf(item: {
  catalogItem: { attributes: unknown };
}): number {
  const attrs = item.catalogItem.attributes as Record<string, unknown>;
  const n = Number(attrs?.pieceCount);
  return Number.isFinite(n) ? n : 500;
}

/** Guard: assert a rental is in one of the expected states before mutating. */
function assertStatus(current: RentalStatus, allowed: RentalStatus[]) {
  if (!allowed.includes(current)) {
    throw new RentalError(
      `Illegal transition from ${current} (expected: ${allowed.join(", ")})`,
    );
  }
}

/** Borrower requests to borrow an available item for a chosen period. */
export async function requestRental(params: {
  borrowerId: string;
  inventoryItemId: string;
  periodDays: number;
  useCredit?: boolean;
}) {
  const { borrowerId, inventoryItemId, periodDays, useCredit } = params;
  if (!isAllowedPeriod(periodDays)) {
    throw new RentalError("Invalid rental period");
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
  });
  if (!item) throw new RentalError("Item not found");
  if (item.status !== "AVAILABLE") throw new RentalError("Item is not available");
  if (item.ownerId && item.ownerId === borrowerId) {
    throw new RentalError("You can't borrow your own listing");
  }

  const quotedFeeCents = quoteRentalFeeCents(item.ratePerWeekCents, periodDays);

  // The borrower may opt to apply a monthly credit; record the intent only if
  // they actually have one available. It's consumed at approval time.
  let creditIntent = false;
  if (useCredit) {
    const sub = await getActiveSubscription(borrowerId);
    if (sub && sub.creditsRemaining > 0) creditIntent = true;
  }

  return prisma.rental.create({
    data: {
      inventoryItemId,
      borrowerId,
      status: "REQUESTED",
      periodDays,
      quotedFeeCents,
      usedCredit: creditIntent,
    },
  });
}

/**
 * Owner (or admin, for warehouse copies) approves a request. Charges the
 * rental fee — or consumes a subscription credit — holds the deposit, sets the
 * due date, and marks the copy ON_LOAN. Runs in a transaction.
 */
export async function approveRental(params: {
  rentalId: string;
  actorId: string;
  actorIsAdmin: boolean;
}) {
  const { rentalId, actorId, actorIsAdmin } = params;
  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: { inventoryItem: true },
  });
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["REQUESTED"]);

  const item = rental.inventoryItem;
  const isOwner = item.ownerId && item.ownerId === actorId;
  const isWarehouseAdmin = !item.ownerId && actorIsAdmin;
  if (!isOwner && !isWarehouseAdmin) {
    throw new RentalError("Only the owner can approve this request");
  }

  // Honor the borrower's credit intent, re-validating a credit is still free.
  let usedCredit = false;
  if (rental.usedCredit) {
    const sub = await getActiveSubscription(rental.borrowerId);
    if (sub && sub.creditsRemaining > 0) usedCredit = true;
  }

  const now = new Date();
  const dueAt = new Date(now.getTime() + rental.periodDays * 24 * 60 * 60 * 1000);
  const payments = getPaymentProvider();

  const updated = await prisma.$transaction(async (tx) => {
    if (usedCredit) {
      await tx.subscription.update({
        where: { userId: rental.borrowerId },
        data: { creditsRemaining: { decrement: 1 } },
      });
    }

    // Hold the refundable deposit.
    await tx.deposit.create({
      data: {
        rentalId: rental.id,
        amountCents: item.depositCents,
        status: "HELD",
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { status: "ON_LOAN" },
    });

    return tx.rental.update({
      where: { id: rental.id },
      data: {
        status: "APPROVED",
        approvedAt: now,
        dueAt,
        usedCredit,
      },
    });
  });

  // Money movements (recorded in the simulated ledger, outside the tx).
  if (!usedCredit && rental.quotedFeeCents > 0) {
    await payments.chargeRentalFee(
      rental.borrowerId,
      rental.id,
      rental.quotedFeeCents,
    );
  }
  if (item.depositCents > 0) {
    await payments.holdDeposit(rental.borrowerId, rental.id, item.depositCents);
  }

  return updated;
}

/** Owner declines a pending request. */
export async function declineRental(params: {
  rentalId: string;
  actorId: string;
  actorIsAdmin: boolean;
}) {
  const rental = await prisma.rental.findUnique({
    where: { id: params.rentalId },
    include: { inventoryItem: true },
  });
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["REQUESTED"]);

  const item = rental.inventoryItem;
  const isOwner = item.ownerId && item.ownerId === params.actorId;
  const isWarehouseAdmin = !item.ownerId && params.actorIsAdmin;
  if (!isOwner && !isWarehouseAdmin) {
    throw new RentalError("Only the owner can decline this request");
  }

  return prisma.rental.update({
    where: { id: rental.id },
    data: { status: "DECLINED" },
  });
}

/** Borrower cancels their own request before it's approved. */
export async function cancelRental(params: {
  rentalId: string;
  borrowerId: string;
}) {
  const rental = await prisma.rental.findUnique({
    where: { id: params.rentalId },
  });
  if (!rental) throw new RentalError("Rental not found");
  if (rental.borrowerId !== params.borrowerId) {
    throw new RentalError("Not your rental");
  }
  assertStatus(rental.status, ["REQUESTED"]);

  return prisma.rental.update({
    where: { id: rental.id },
    data: { status: "CANCELED" },
  });
}

// --------------------------------------------------------------------------
// Fulfillment cycle (Phase 3): ship → receive → return (w/ proof) → inspect
// --------------------------------------------------------------------------

/** Owner ships the item to the borrower. Creates the outbound shipment. */
export async function shipToBorrower(params: {
  rentalId: string;
  actorId: string;
  actorIsAdmin: boolean;
}) {
  const rental = await rentalWithItem(params.rentalId);
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["APPROVED"]);
  if (!isOwnerOrWarehouseAdmin(rental.inventoryItem, params.actorId, params.actorIsAdmin)) {
    throw new RentalError("Only the owner can ship this item");
  }

  await createShipmentAndCharge({
    rentalId: rental.id,
    direction: "OUTBOUND",
    borrowerId: rental.borrowerId,
    ownerId: rental.inventoryItem.ownerId,
    pieceHint: pieceHintOf(rental.inventoryItem),
  });

  return prisma.rental.update({
    where: { id: rental.id },
    data: { status: "SHIPPED_TO_BORROWER" },
  });
}

/** Borrower confirms delivery. */
export async function markReceived(params: {
  rentalId: string;
  borrowerId: string;
}) {
  const rental = await prisma.rental.findUnique({ where: { id: params.rentalId } });
  if (!rental) throw new RentalError("Rental not found");
  if (rental.borrowerId !== params.borrowerId) throw new RentalError("Not your rental");
  assertStatus(rental.status, ["SHIPPED_TO_BORROWER"]);

  await prisma.shipment.updateMany({
    where: { rentalId: rental.id, direction: "OUTBOUND" },
    data: { status: "DELIVERED" },
  });
  return prisma.rental.update({
    where: { id: rental.id },
    data: { status: "IN_HAND" },
  });
}

/**
 * Borrower uploads the completion photo + survey, then ships the item back.
 * The condition photo is REQUIRED to advance — it's the owner's proof that all
 * pieces are present. Runs the proof/experience writes and the transition
 * together, then creates the return shipment.
 */
export async function submitReturn(params: {
  rentalId: string;
  borrowerId: string;
  imageUrl: string;
  proofNote?: string;
  survey: {
    timeToCompleteHours?: number | null;
    difficultyRating?: number | null;
    enjoymentRating?: number | null;
    missingPiecesReported?: number;
    notes?: string | null;
  };
}) {
  const rental = await rentalWithItem(params.rentalId);
  if (!rental) throw new RentalError("Rental not found");
  if (rental.borrowerId !== params.borrowerId) throw new RentalError("Not your rental");
  assertStatus(rental.status, ["IN_HAND"]);
  if (!params.imageUrl) {
    throw new RentalError("A completion photo is required to return the item");
  }

  await prisma.$transaction(async (tx) => {
    await tx.conditionProof.create({
      data: {
        rentalId: rental.id,
        imageUrl: params.imageUrl,
        note: params.proofNote,
      },
    });
    await tx.rentalExperience.create({
      data: {
        rentalId: rental.id,
        timeToCompleteHours: params.survey.timeToCompleteHours ?? null,
        difficultyRating: params.survey.difficultyRating ?? null,
        enjoymentRating: params.survey.enjoymentRating ?? null,
        missingPiecesReported: params.survey.missingPiecesReported ?? 0,
        notes: params.survey.notes ?? null,
      },
    });
    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "RETURN_SHIPPED", returnedAt: new Date() },
    });
  });

  await createShipmentAndCharge({
    rentalId: rental.id,
    direction: "RETURN",
    borrowerId: rental.borrowerId,
    ownerId: rental.inventoryItem.ownerId,
    pieceHint: pieceHintOf(rental.inventoryItem),
  });

  return prisma.rental.findUnique({ where: { id: rental.id } });
}

/** Owner marks the returned shipment delivered back to them. */
export async function markReturned(params: {
  rentalId: string;
  actorId: string;
  actorIsAdmin: boolean;
}) {
  const rental = await rentalWithItem(params.rentalId);
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["RETURN_SHIPPED"]);
  if (!isOwnerOrWarehouseAdmin(rental.inventoryItem, params.actorId, params.actorIsAdmin)) {
    throw new RentalError("Only the owner can mark this returned");
  }

  await prisma.shipment.updateMany({
    where: { rentalId: rental.id, direction: "RETURN" },
    data: { status: "DELIVERED" },
  });
  return prisma.rental.update({
    where: { id: rental.id },
    data: { status: "RETURNED" },
  });
}

/**
 * Owner/admin inspects the returned item. Either completes the rental
 * (deposit refunded, item back in circulation) or opens a dispute (deposit
 * stays held until an admin resolves it). Revenue-share payout is layered in
 * at COMPLETED in Phase 4 via settleCompletedRental().
 */
export async function inspectRental(params: {
  rentalId: string;
  actorId: string;
  actorIsAdmin: boolean;
  outcome: "complete" | "dispute";
  disputeReason?: string;
}) {
  const rental = await rentalWithItem(params.rentalId);
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["RETURNED"]);
  if (!isOwnerOrWarehouseAdmin(rental.inventoryItem, params.actorId, params.actorIsAdmin)) {
    throw new RentalError("Only the owner can inspect this return");
  }

  if (params.outcome === "dispute") {
    await prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          rentalId: rental.id,
          raisedByUserId: params.actorId,
          reason: params.disputeReason?.trim() || "Damage or missing pieces reported",
        },
      });
      await tx.rental.update({
        where: { id: rental.id },
        data: { status: "DISPUTED" },
      });
    });
    return prisma.rental.findUnique({ where: { id: rental.id } });
  }

  return settleCompletedRental(rental.id);
}

/**
 * Finalize a rental as COMPLETED: refund the full deposit and return the copy
 * to circulation. (Phase 4 extends this to compute and pay the owner's
 * revenue-share and any deposit forfeiture on dispute resolution.)
 */
export async function settleCompletedRental(rentalId: string) {
  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: { deposit: true, inventoryItem: true },
  });
  if (!rental) throw new RentalError("Rental not found");

  await prisma.$transaction(async (tx) => {
    if (rental.deposit && rental.deposit.status === "HELD") {
      await tx.deposit.update({
        where: { id: rental.deposit.id },
        data: {
          status: "REFUNDED",
          refundedCents: rental.deposit.amountCents,
          forfeitedCents: 0,
        },
      });
    }
    await tx.inventoryItem.update({
      where: { id: rental.inventoryItemId },
      data: { status: "AVAILABLE" },
    });
    await tx.rental.update({
      where: { id: rentalId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  if (rental.deposit && rental.deposit.amountCents > 0) {
    await getPaymentProvider().releaseDeposit(
      rental.borrowerId,
      rentalId,
      rental.deposit.amountCents,
      0,
    );
  }

  // Split the rental fee between owner and platform (locked-in at completion).
  await settleRevenueShare(rentalId);

  return prisma.rental.findUnique({ where: { id: rentalId } });
}

/**
 * Admin resolves a dispute: forfeit part/all of the deposit (paid to a P2P
 * owner, kept by the platform for warehouse copies), then complete the rental.
 * The rental-fee revenue split still runs at completion, independent of the
 * deposit forfeiture.
 */
export async function resolveDispute(params: {
  rentalId: string;
  adminId: string;
  forfeitCents: number;
  notes?: string;
}) {
  const rental = await prisma.rental.findUnique({
    where: { id: params.rentalId },
    include: { deposit: true, inventoryItem: true, dispute: true },
  });
  if (!rental) throw new RentalError("Rental not found");
  assertStatus(rental.status, ["DISPUTED"]);
  if (!rental.deposit) throw new RentalError("No deposit to settle");

  const amount = rental.deposit.amountCents;
  const forfeit = Math.max(0, Math.min(params.forfeitCents, amount));
  const refund = amount - forfeit;
  const depositStatus =
    forfeit === 0 ? "REFUNDED" : forfeit === amount ? "FORFEITED" : "PARTIALLY_FORFEITED";

  await prisma.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: rental.deposit!.id },
      data: { status: depositStatus, refundedCents: refund, forfeitedCents: forfeit },
    });
    await tx.dispute.update({
      where: { rentalId: rental.id },
      data: {
        status: "RESOLVED",
        resolvedByAdminId: params.adminId,
        resolutionNotes: params.notes,
        resolvedAt: new Date(),
      },
    });
    await tx.inventoryItem.update({
      where: { id: rental.inventoryItemId },
      data: { status: "AVAILABLE" },
    });
    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  // Move deposit money: refund to borrower, forfeit to owner (P2P) / platform.
  await getPaymentProvider().releaseDeposit(
    rental.borrowerId,
    rental.id,
    refund,
    forfeit,
  );
  if (forfeit > 0 && rental.inventoryItem.ownerId) {
    await getPaymentProvider().payoutOwner(
      rental.inventoryItem.ownerId,
      rental.id,
      forfeit,
    );
  }

  // Rental-fee split still applies.
  await settleRevenueShare(rental.id);

  return prisma.rental.findUnique({ where: { id: rental.id } });
}
