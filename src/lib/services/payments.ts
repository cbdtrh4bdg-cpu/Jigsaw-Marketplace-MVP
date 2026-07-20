import type { Prisma, PrismaClient } from "@prisma/client";
import { PaymentStatus, PaymentType } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface ChargeInput {
  userId?: string | null;
  rentalId?: string | null;
  type: PaymentType;
  amountCents: number;
  note?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Record a charge/refund/payout. Simulated impl always succeeds. */
  record(db: Db, input: ChargeInput): Promise<{ reference: string }>;
}

/**
 * Simulated provider: writes a SimulatedPayment audit row and "succeeds". Swap
 * for a real Stripe-backed impl behind this same interface later.
 */
class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async record(db: Db, input: ChargeInput) {
    const row = await db.simulatedPayment.create({
      data: {
        userId: input.userId ?? null,
        rentalId: input.rentalId ?? null,
        type: input.type,
        amountCents: input.amountCents,
        status: PaymentStatus.SUCCEEDED,
        provider: this.name,
        note: input.note,
      },
    });
    return { reference: row.reference };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  switch (process.env.PAYMENT_PROVIDER) {
    // case "stripe": provider = new StripePaymentProvider(); break;
    default:
      provider = new SimulatedPaymentProvider();
  }
  return provider;
}
