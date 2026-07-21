import { prisma } from "@/lib/db";
import { requireSession, getActiveSubscription } from "@/lib/permissions";
import { formatCents } from "@/lib/format";
import { SubscribeButton } from "./subscribe-button";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const user = await requireSession();
  const [plans, sub] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { monthlyPriceCents: "asc" } }),
    getActiveSubscription(user.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Membership</h1>
      <p className="mt-1 text-sm text-slate-500">
        A subscription unlocks the shared library and lets you borrow. Each plan
        includes monthly credits that waive rental fees (you still pay the
        refundable deposit and shipping).
      </p>

      {sub && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You have an active subscription with{" "}
          <strong>{sub.creditsRemaining}</strong> credit
          {sub.creditsRemaining === 1 ? "" : "s"} remaining this period.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const current = sub?.planId === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-white p-6 shadow-sm ${
                current ? "border-brand-400 ring-1 ring-brand-300" : "border-slate-200"
              }`}
            >
              <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
              <p className="mt-2">
                <span className="text-3xl font-bold text-slate-900">
                  {formatCents(plan.monthlyPriceCents)}
                </span>
                <span className="text-sm text-slate-500"> / month</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  {plan.monthlyCredits > 0
                    ? `${plan.monthlyCredits} free rental credit${plan.monthlyCredits === 1 ? "" : "s"} / month`
                    : "Pay-as-you-go rentals"}
                </li>
                <li>Full access to the shared library</li>
                {plan.earlyAccess && <li>Early access to new arrivals</li>}
              </ul>
              <div className="mt-auto">
                <SubscribeButton planId={plan.id} current={current} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
