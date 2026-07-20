import { prisma } from "@/lib/db";
import { PaymentType } from "@prisma/client";
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
  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.findUnique({ where: { key: planKey } });
    if (!plan || !plan.active) {
      throw new SubscriptionError("Unknown or inactive plan", 404);
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (plan.priceCents > 0) {
      await getPaymentProvider().record(tx, {
        userId,
        type: PaymentType.SUBSCRIPTION,
        amountCents: plan.priceCents,
        note: `Subscription: ${plan.name}`,
      });
    }

    return tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        active: true,
        creditsRemaining: plan.monthlyCredits,
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: plan.id,
        active: true,
        creditsRemaining: plan.monthlyCredits,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });
  });
}
