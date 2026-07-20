import { requireUserPage } from "@/lib/pageAuth";
import { supabaseAdmin } from "@/lib/supabase";
import type { SubscriptionPlanRow, SubscriptionRow } from "@/lib/db-types";
import { Badge, Card } from "@/components/ui";
import { PlanPicker } from "@/components/PlanPicker";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const user = await requireUserPage("/subscribe");
  const db = supabaseAdmin();

  const [{ data: planRows }, { data: subRow }] = await Promise.all([
    db.from("SubscriptionPlan").select("*").eq("active", true).order("priceCents"),
    db.from("Subscription").select("*").eq("userId", user.id).maybeSingle(),
  ]);
  const plans = (planRows as SubscriptionPlanRow[] | null) ?? [];
  const subscription = subRow as SubscriptionRow | null;
  const currentPlan = subscription
    ? plans.find((p) => p.id === subscription.planId)
    : undefined;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Subscription</h1>
      <p className="mb-6 text-sm text-slate-500">
        A flat monthly fee grants marketplace access and the right to borrow.
        Monthly credits offset per-rental fees; shipping is always pass-through.
      </p>

      {subscription && currentPlan ? (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{currentPlan.name} plan</p>
              <p className="text-sm text-slate-500">
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <Badge tone="indigo">
              {subscription.creditsRemaining} credits left
            </Badge>
          </div>
        </Card>
      ) : null}

      <PlanPicker plans={plans} currentPlanKey={currentPlan?.key} />
    </div>
  );
}
