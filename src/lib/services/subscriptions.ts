import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/services/payments";

/**
 * Subscribe (or switch plan for) a user. Charges the monthly fee via the
 * payment provider, then upserts an ACTIVE subscription seeded with the plan's
 * monthly credits and a one-month period.
 */
export async function subscribeUser(userId: string, planId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      creditsRemaining: plan.monthlyCredits,
    },
    create: {
      userId,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      creditsRemaining: plan.monthlyCredits,
    },
  });

  await getPaymentProvider().chargeSubscription(
    userId,
    subscription.id,
    plan.monthlyPriceCents,
  );

  return subscription;
}
