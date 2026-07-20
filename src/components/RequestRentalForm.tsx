"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RENTAL_PERIOD_DAYS } from "@/lib/config";
import { quoteRentalFeeCents } from "@/lib/services/pricing";
import { Button, Field, Select } from "@/components/ui";
import { formatCents } from "@/lib/money";

export function RequestRentalForm({
  inventoryItemId,
  ratePerWeekCents,
  depositCents,
  disabled,
  disabledReason,
}: {
  inventoryItemId: string;
  ratePerWeekCents: number;
  depositCents: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState<number>(RENTAL_PERIOD_DAYS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quotedFee = useMemo(
    () => quoteRentalFeeCents(ratePerWeekCents, periodDays),
    [ratePerWeekCents, periodDays],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/rentals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryItemId, periodDays }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not request this rental");
      return;
    }
    router.push("/my-rentals");
    router.refresh();
  }

  if (disabled) {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
        {disabledReason ?? "Not available to borrow."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Field label="Rental period">
        <Select
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
        >
          {RENTAL_PERIOD_DAYS.map((d) => (
            <option key={d} value={d}>
              {d / 7} week{d / 7 === 1 ? "" : "s"} ({d} days)
            </option>
          ))}
        </Select>
      </Field>
      <dl className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Rental fee</dt>
          <dd className="font-medium">{formatCents(quotedFee)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Refundable deposit</dt>
          <dd className="font-medium">{formatCents(depositCents)}</dd>
        </div>
        <p className="pt-1 text-xs text-slate-400">
          + shipping both directions (charged at each leg). Credits, if any, are
          applied at approval.
        </p>
      </dl>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Requesting…" : "Request to borrow"}
      </Button>
    </form>
  );
}
