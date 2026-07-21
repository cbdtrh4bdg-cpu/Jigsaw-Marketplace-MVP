import type { RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/services/payments";
import { quoteRentalFeeCents, isAllowedPeriod } from "@/lib/services/pricing";
import { getActiveSubscription } from "@/lib/permissions";

export class RentalError extends Error {}

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
