import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/pageAuth";
import { Badge, Card } from "@/components/ui";
import { PlanPicker } from "@/components/PlanPicker";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const user = await requireUserPage("/subscribe");
  const [plans, subscription] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceCents: "asc" },
    }),
    prisma.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Subscription</h1>
      <p className="mb-6 text-sm text-slate-500">
        A flat monthly fee grants marketplace access and the right to borrow.
        Monthly credits offset per-rental fees; shipping is always pass-through.
      </p>

      {subscription ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{subscription.plan.name} plan</p>
              <p className="text-sm text-slate-500">
                Renews {subscription.currentPeriodEnd.toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <Badge tone="indigo">
                {subscription.creditsRemaining} credits left
              </Badge>
            </div>
          </div>
        </Card>
      ) : null}

      <PlanPicker plans={plans} currentPlanKey={subscription?.plan.key} />
    </div>
  );
}
