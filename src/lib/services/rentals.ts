import { prisma } from "@/lib/db";
import {
  DepositStatus,
  DisputeStatus,
  InventoryStatus,
  PayerRole,
  PaymentType,
  Prisma,
  RentalStatus,
  Role,
  ShipmentDirection,
  ShipmentStatus,
} from "@prisma/client";
import { SHIPPING_POLICY, isValidPeriod } from "@/lib/config";
import { applyCredits, computeDueAt, quoteRentalFeeCents } from "./pricing";
import { assertTransition } from "./rentalStateMachine";
import { getPaymentProvider } from "./payments";
import { getShippingProvider } from "./shipping";
import { resolveRevenueShare } from "./revenueShareResolver";

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

const rentalInclude = {
  inventoryItem: { include: { catalogItem: true, owner: true } },
  borrower: true,
  deposit: true,
  shipments: true,
  conditionProof: true,
  experience: true,
  dispute: true,
} satisfies Prisma.RentalInclude;

async function loadRental(tx: Prisma.TransactionClient, id: string) {
  const rental = await tx.rental.findUnique({ where: { id }, include: rentalInclude });
  if (!rental) throw new RentalError("Rental not found", 404);
  return rental;
}

function isOwnerOrAdmin(
  rental: { inventoryItem: { ownerId: string | null } },
  user: ActingUser,
): boolean {
  if (user.role === Role.ADMIN) return true;
  return rental.inventoryItem.ownerId === user.id;
}

function payerFor(
  role: PayerRole,
  rental: { borrowerId: string; inventoryItem: { ownerId: string | null } },
): string | null {
  switch (role) {
    case PayerRole.BORROWER:
      return rental.borrowerId;
    case PayerRole.LENDER:
      return rental.inventoryItem.ownerId;
    case PayerRole.PLATFORM:
      return null;
  }
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
  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
  });
  if (!item) throw new RentalError("Inventory item not found", 404);
  if (item.status !== InventoryStatus.AVAILABLE) {
    throw new RentalError("This copy is not currently available");
  }
  if (item.ownerId === input.borrowerId) {
    throw new RentalError("You cannot borrow your own listing");
  }

  return prisma.rental.create({
    data: {
      inventoryItemId: item.id,
      borrowerId: input.borrowerId,
      periodDays: input.periodDays,
      status: RentalStatus.REQUESTED,
    },
    include: rentalInclude,
  });
}

// --- Approve / Decline / Cancel ------------------------------------------

export async function approveRental(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
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
    const sub = await tx.subscription.findUnique({
      where: { userId: rental.borrowerId },
    });
    const { chargeCents, creditsApplied } = applyCredits(
      quotedFeeCents,
      sub?.creditsRemaining ?? 0,
    );

    const payments = getPaymentProvider();
    if (chargeCents > 0) {
      await payments.record(tx, {
        userId: rental.borrowerId,
        rentalId: rental.id,
        type: PaymentType.RENTAL_FEE,
        amountCents: chargeCents,
        note: `Rental fee (${rental.periodDays}d)`,
      });
    }
    if (creditsApplied > 0 && sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { creditsRemaining: { decrement: creditsApplied } },
      });
    }

    // Hold the refundable deposit.
    await payments.record(tx, {
      userId: rental.borrowerId,
      rentalId: rental.id,
      type: PaymentType.DEPOSIT_HOLD,
      amountCents: rental.inventoryItem.depositCents,
      note: "Refundable deposit hold",
    });
    await tx.deposit.create({
      data: {
        rentalId: rental.id,
        amountCents: rental.inventoryItem.depositCents,
        status: DepositStatus.HELD,
      },
    });

    // Reserve the copy so it can't be double-booked.
    await tx.inventoryItem.update({
      where: { id: rental.inventoryItemId },
      data: { status: InventoryStatus.RESERVED },
    });

    return tx.rental.update({
      where: { id: rental.id },
      data: {
        status: RentalStatus.APPROVED,
        approvedAt: now,
        dueAt: computeDueAt(now, rental.periodDays),
        quotedFeeCents,
        creditsApplied,
      },
      include: rentalInclude,
    });
  });
}

export async function declineRental(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (!isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Only the owner can decline this request", 403);
    }
    assertTransition(rental.status, RentalStatus.DECLINED);
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.DECLINED },
      include: rentalInclude,
    });
  });
}

export async function cancelRental(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    const isBorrower = rental.borrowerId === user.id;
    if (!isBorrower && !isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Not authorized to cancel this rental", 403);
    }
    assertTransition(rental.status, RentalStatus.CANCELED);

    // Refund anything already charged and release any reservation/deposit.
    if (rental.status === RentalStatus.APPROVED) {
      await releaseHoldAndReservation(tx, rental);
    }
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.CANCELED },
      include: rentalInclude,
    });
  });
}

async function releaseHoldAndReservation(
  tx: Prisma.TransactionClient,
  rental: Awaited<ReturnType<typeof loadRental>>,
) {
  const payments = getPaymentProvider();
  if (rental.deposit && rental.deposit.status === DepositStatus.HELD) {
    await payments.record(tx, {
      userId: rental.borrowerId,
      rentalId: rental.id,
      type: PaymentType.DEPOSIT_REFUND,
      amountCents: rental.deposit.amountCents,
      note: "Deposit refunded (canceled)",
    });
    await tx.deposit.update({
      where: { rentalId: rental.id },
      data: { status: DepositStatus.REFUNDED, resolvedAt: new Date() },
    });
  }
  await tx.inventoryItem.update({
    where: { id: rental.inventoryItemId },
    data: { status: InventoryStatus.AVAILABLE },
  });
}

// --- Shipping legs --------------------------------------------------------

export async function shipToBorrower(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (!isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Only the owner can mark this shipped", 403);
    }
    assertTransition(rental.status, RentalStatus.SHIPPED_TO_BORROWER);
    await createShipmentLeg(tx, rental, ShipmentDirection.OUTBOUND, SHIPPING_POLICY.outboundPaidBy);
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.SHIPPED_TO_BORROWER, shippedAt: new Date() },
      include: rentalInclude,
    });
  });
}

export async function receiveByBorrower(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
      throw new RentalError("Only the borrower can confirm receipt", 403);
    }
    assertTransition(rental.status, RentalStatus.IN_HAND);
    await tx.shipment.updateMany({
      where: { rentalId: rental.id, direction: ShipmentDirection.OUTBOUND },
      data: { status: ShipmentStatus.DELIVERED, deliveredAt: new Date() },
    });
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.IN_HAND, receivedAt: new Date() },
      include: rentalInclude,
    });
  });
}

export async function returnShip(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
      throw new RentalError("Only the borrower can ship the return", 403);
    }
    // Gate: cannot return without uploading the completion photo proof.
    if (!rental.conditionProof) {
      throw new RentalError(
        "Upload the completion photo before shipping the return",
      );
    }
    assertTransition(rental.status, RentalStatus.RETURN_SHIPPED);
    await createShipmentLeg(tx, rental, ShipmentDirection.RETURN, SHIPPING_POLICY.returnPaidBy);
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.RETURN_SHIPPED, returnShippedAt: new Date() },
      include: rentalInclude,
    });
  });
}

export async function markReturned(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (!isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Only the owner can confirm the return", 403);
    }
    assertTransition(rental.status, RentalStatus.RETURNED);
    await tx.shipment.updateMany({
      where: { rentalId: rental.id, direction: ShipmentDirection.RETURN },
      data: { status: ShipmentStatus.DELIVERED, deliveredAt: new Date() },
    });
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.RETURNED, returnedAt: new Date() },
      include: rentalInclude,
    });
  });
}

async function createShipmentLeg(
  tx: Prisma.TransactionClient,
  rental: Awaited<ReturnType<typeof loadRental>>,
  direction: ShipmentDirection,
  paidByRole: PayerRole,
) {
  const shipping = getShippingProvider();
  const label = await shipping.buyLabel(direction);
  const paidByUserId = payerFor(paidByRole, rental);

  await tx.shipment.create({
    data: {
      rentalId: rental.id,
      direction,
      status: ShipmentStatus.IN_TRANSIT,
      costCents: label.costCents,
      paidByUserId,
      paidByRole,
      trackingCode: label.trackingCode,
    },
  });

  await getPaymentProvider().record(tx, {
    userId: paidByUserId,
    rentalId: rental.id,
    type: PaymentType.SHIPPING,
    amountCents: label.costCents,
    note: `${direction} shipping (paid by ${paidByRole})`,
  });
}

// --- Condition proof + survey --------------------------------------------

export async function uploadConditionProof(
  rentalId: string,
  user: ActingUser,
  input: { imageUrl: string; note?: string },
) {
  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  if (!rental) throw new RentalError("Rental not found", 404);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can upload the proof", 403);
  }
  if (rental.status !== RentalStatus.IN_HAND) {
    throw new RentalError("Proof can only be uploaded while the copy is in hand");
  }
  return prisma.conditionProof.upsert({
    where: { rentalId },
    create: { rentalId, imageUrl: input.imageUrl, note: input.note },
    update: { imageUrl: input.imageUrl, note: input.note },
  });
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
  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  if (!rental) throw new RentalError("Rental not found", 404);
  if (rental.borrowerId !== user.id && user.role !== Role.ADMIN) {
    throw new RentalError("Only the borrower can submit the survey", 403);
  }
  return prisma.rentalExperience.upsert({
    where: { rentalId },
    create: { rentalId, missingPiecesReported: 0, ...input },
    update: { ...input },
  });
}

// --- Inspection: complete or dispute -------------------------------------

export async function inspectComplete(rentalId: string, user: ActingUser) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (!isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Only the owner can complete this rental", 403);
    }
    assertTransition(rental.status, RentalStatus.COMPLETED);
    await refundDepositAndPayout(tx, rental, { forfeitCents: 0 });
    return finalizeCompleted(tx, rental.id, rental.inventoryItemId);
  });
}

export async function openDispute(
  rentalId: string,
  user: ActingUser,
  input: { reason: string },
) {
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    if (!isOwnerOrAdmin(rental, user)) {
      throw new RentalError("Only the owner can open a dispute", 403);
    }
    assertTransition(rental.status, RentalStatus.DISPUTED);
    await tx.dispute.create({
      data: {
        rentalId: rental.id,
        openedById: user.id,
        reason: input.reason,
        status: DisputeStatus.OPEN,
      },
    });
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.DISPUTED },
      include: rentalInclude,
    });
  });
}

export async function resolveDispute(
  rentalId: string,
  user: ActingUser,
  input: { resolution: string; forfeitCents: number },
) {
  if (user.role !== Role.ADMIN) {
    throw new RentalError("Only an admin can resolve disputes", 403);
  }
  return prisma.$transaction(async (tx) => {
    const rental = await loadRental(tx, rentalId);
    assertTransition(rental.status, RentalStatus.COMPLETED);
    const forfeit = Math.max(
      0,
      Math.min(input.forfeitCents, rental.deposit?.amountCents ?? 0),
    );
    await refundDepositAndPayout(tx, rental, { forfeitCents: forfeit });
    await tx.dispute.update({
      where: { rentalId: rental.id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: input.resolution,
        forfeitCents: forfeit,
        resolvedAt: new Date(),
      },
    });
    return finalizeCompleted(tx, rental.id, rental.inventoryItemId);
  });
}

/**
 * Settle the deposit (refund the un-forfeited remainder; route forfeited money
 * to the lender for P2P or the platform for warehouse) and pay out the rental
 * fee via the revenue-share split.
 */
async function refundDepositAndPayout(
  tx: Prisma.TransactionClient,
  rental: Awaited<ReturnType<typeof loadRental>>,
  opts: { forfeitCents: number },
) {
  const payments = getPaymentProvider();
  const deposit = rental.deposit;
  if (deposit && deposit.status === DepositStatus.HELD) {
    const forfeit = Math.min(opts.forfeitCents, deposit.amountCents);
    const refund = deposit.amountCents - forfeit;

    if (refund > 0) {
      await payments.record(tx, {
        userId: rental.borrowerId,
        rentalId: rental.id,
        type: PaymentType.DEPOSIT_REFUND,
        amountCents: refund,
        note: "Deposit refunded",
      });
    }
    if (forfeit > 0) {
      // Forfeited money goes to the lender (P2P) or platform (warehouse).
      await payments.record(tx, {
        userId: rental.inventoryItem.ownerId, // null => platform
        rentalId: rental.id,
        type: PaymentType.DEPOSIT_FORFEIT,
        amountCents: forfeit,
        note: "Deposit forfeited (damage/missing pieces)",
      });
    }
    await tx.deposit.update({
      where: { rentalId: rental.id },
      data: {
        status:
          forfeit === 0
            ? DepositStatus.REFUNDED
            : forfeit >= deposit.amountCents
              ? DepositStatus.FORFEITED
              : DepositStatus.PARTIALLY_FORFEITED,
        forfeitedCents: forfeit,
        resolvedAt: new Date(),
      },
    });
  }

  // Revenue-share payout for the rental fee (locked in at completion).
  const split = await resolveRevenueShare(tx, rental.id);
  await tx.revenueShareEntry.create({
    data: {
      rentalId: rental.id,
      ownerId: split.ownerId,
      feeCents: split.feeCents,
      ownerStanding: split.ownerStanding,
      platformFeeBps: split.platformFeeBps,
      popularityBonusBps: split.popularityBonusBps,
      ownerPayoutCents: split.ownerPayoutCents,
      platformCents: split.platformCents,
    },
  });
  if (split.ownerId && split.ownerPayoutCents > 0) {
    await payments.record(tx, {
      userId: split.ownerId,
      rentalId: rental.id,
      type: PaymentType.PAYOUT,
      amountCents: split.ownerPayoutCents,
      note: "Owner payout",
    });
  }
}

async function finalizeCompleted(
  tx: Prisma.TransactionClient,
  rentalId: string,
  inventoryItemId: string,
) {
  await tx.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { status: InventoryStatus.AVAILABLE },
  });
  return tx.rental.update({
    where: { id: rentalId },
    data: { status: RentalStatus.COMPLETED, completedAt: new Date() },
    include: rentalInclude,
  });
}
