import type { PaymentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface PaymentResult {
  ok: boolean;
  referenceId: string;
  paymentId?: string;
}

// The seam between our domain logic and any real payment processor. Swapping in
// Stripe later means implementing this interface — no call site changes.
export interface PaymentProvider {
  chargeSubscription(
    userId: string,
    subscriptionId: string,
    amountCents: number,
  ): Promise<PaymentResult>;
  chargeRentalFee(
    userId: string,
    rentalId: string,
    amountCents: number,
  ): Promise<PaymentResult>;
  holdDeposit(
    userId: string,
    rentalId: string,
    amountCents: number,
  ): Promise<PaymentResult>;
  releaseDeposit(
    userId: string,
    rentalId: string,
    refundCents: number,
    forfeitCents: number,
  ): Promise<PaymentResult>;
  chargeShipping(
    userId: string,
    rentalId: string,
    amountCents: number,
  ): Promise<PaymentResult>;
  payoutOwner(
    ownerId: string,
    rentalId: string,
    amountCents: number,
  ): Promise<PaymentResult>;
  recordPlatformFee(rentalId: string, amountCents: number): Promise<PaymentResult>;
}

// Records every money movement as a SimulatedPayment row and always succeeds.
class SimulatedPaymentProvider implements PaymentProvider {
  private async record(
    type: PaymentType,
    amountCents: number,
    referenceId: string,
    userId: string | null,
    note?: string,
  ): Promise<PaymentResult> {
    const row = await prisma.simulatedPayment.create({
      data: {
        type,
        amountCents,
        referenceId,
        userId: userId ?? undefined,
        note,
      } satisfies Prisma.SimulatedPaymentUncheckedCreateInput,
    });
    return { ok: true, referenceId, paymentId: row.id };
  }

  chargeSubscription(userId: string, subscriptionId: string, amountCents: number) {
    return this.record("SUBSCRIPTION_CHARGE", amountCents, subscriptionId, userId);
  }
  chargeRentalFee(userId: string, rentalId: string, amountCents: number) {
    return this.record("RENTAL_FEE", amountCents, rentalId, userId);
  }
  holdDeposit(userId: string, rentalId: string, amountCents: number) {
    return this.record("DEPOSIT_HOLD", amountCents, rentalId, userId);
  }
  async releaseDeposit(
    userId: string,
    rentalId: string,
    refundCents: number,
    forfeitCents: number,
  ) {
    if (refundCents > 0)
      await this.record("DEPOSIT_REFUND", refundCents, rentalId, userId);
    if (forfeitCents > 0)
      await this.record("DEPOSIT_FORFEIT", forfeitCents, rentalId, userId);
    return { ok: true, referenceId: rentalId };
  }
  chargeShipping(userId: string, rentalId: string, amountCents: number) {
    return this.record("SHIPPING_CHARGE", amountCents, rentalId, userId);
  }
  payoutOwner(ownerId: string, rentalId: string, amountCents: number) {
    return this.record("OWNER_PAYOUT", amountCents, rentalId, ownerId);
  }
  recordPlatformFee(rentalId: string, amountCents: number) {
    return this.record("PLATFORM_FEE", amountCents, rentalId, null);
  }
}

let provider: PaymentProvider | null = null;

// Factory reads PAYMENT_PROVIDER; real Stripe impl drops in here later.
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    switch (process.env.PAYMENT_PROVIDER) {
      case "simulated":
      default:
        provider = new SimulatedPaymentProvider();
    }
  }
  return provider;
}
