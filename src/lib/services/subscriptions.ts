import { supabaseAdmin } from "@/lib/supabase";
import {
  PaymentType,
  type SubscriptionPlanRow,
  type SubscriptionRow,
} from "@/lib/db-types";
import { getPaymentProvider } from "./payments";

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

/**
 * Subscribe (or switch plans). Charges the plan price via the simulated
 * payment provider, grants the plan's monthly credits, and extends the period
 * one month.
 */
export async function subscribe(userId: string, planKey: string) {
  const db = supabaseAdmin();
  const { data: planRow } = await db
    .from("SubscriptionPlan")
    .select("*")
    .eq("key", planKey)
    .maybeSingle();
  const plan = planRow as SubscriptionPlanRow | null;
  if (!plan || !plan.active) {
    throw new SubscriptionError("Unknown or inactive plan", 404);
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  if (plan.priceCents > 0) {
    await getPaymentProvider().record({
      userId,
      type: PaymentType.SUBSCRIPTION,
      amountCents: plan.priceCents,
      note: `Subscription: ${plan.name}`,
    });
  }

  const { data, error } = await db
    .from("Subscription")
    .upsert(
      {
        userId,
        planId: plan.id,
        active: true,
        creditsRemaining: plan.monthlyCredits,
        currentPeriodEnd: periodEnd.toISOString(),
      },
      { onConflict: "userId" },
    )
    .select("*")
    .single();
  if (error) throw new SubscriptionError(`Subscription failed: ${error.message}`, 500);
  return { ...(data as SubscriptionRow), plan };
}
