"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";

export interface PlanView {
  key: string;
  name: string;
  priceCents: number;
  monthlyCredits: number;
}

export function PlanPicker({
  plans,
  currentPlanKey,
}: {
  plans: PlanView[];
  currentPlanKey?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(planKey: string) {
    setLoading(planKey);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey }),
    });
    setLoading(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const current = plan.key === currentPlanKey;
        return (
          <Card key={plan.key} className="flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {current ? <Badge tone="green">Current</Badge> : null}
            </div>
            <p className="mt-2 text-3xl font-bold">
              {plan.priceCents === 0 ? "Free" : formatCents(plan.priceCents)}
              {plan.priceCents > 0 ? (
                <span className="text-sm font-normal text-slate-500">/mo</span>
              ) : null}
            </p>
            <ul className="mt-4 flex-1 space-y-1 text-sm text-slate-600">
              <li>✓ Browse the marketplace</li>
              <li>✓ Request borrows</li>
              <li>
                ✓ {plan.monthlyCredits} rental credit
                {plan.monthlyCredits === 1 ? "" : "s"} / month
              </li>
            </ul>
            <Button
              className="mt-4"
              variant={current ? "secondary" : "primary"}
              disabled={loading !== null}
              onClick={() => subscribe(plan.key)}
            >
              {loading === plan.key
                ? "Processing…"
                : current
                  ? "Renew"
                  : "Choose plan"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
