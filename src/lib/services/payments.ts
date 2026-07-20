import { supabaseAdmin } from "@/lib/supabase";
import { PaymentStatus, PaymentType } from "@/lib/db-types";

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
  record(input: ChargeInput): Promise<{ reference: string }>;
}

/**
 * Simulated provider: writes a SimulatedPayment audit row and "succeeds". Swap
 * for a real Stripe-backed impl behind this same interface later.
 *
 * Note: money operations that must be atomic (deposit hold + fee + reservation,
 * settlement + payout, etc.) are performed inside Postgres RPC functions — see
 * supabase/migrations/0002_functions.sql — so those insert their own audit
 * rows transactionally. This provider covers the standalone charges
 * (subscription) and is the seam where a real gateway plugs in.
 */
class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";

  async record(input: ChargeInput) {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("SimulatedPayment")
      .insert({
        userId: input.userId ?? null,
        rentalId: input.rentalId ?? null,
        type: input.type,
        amountCents: input.amountCents,
        status: PaymentStatus.SUCCEEDED,
        provider: this.name,
        note: input.note ?? null,
      })
      .select("reference")
      .single();
    if (error) throw new Error(`Payment record failed: ${error.message}`);
    return { reference: (data as { reference: string }).reference };
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
