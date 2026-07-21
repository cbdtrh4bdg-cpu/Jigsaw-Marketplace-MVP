"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RENTAL_PERIODS } from "@/lib/config";
import { quoteRentalFeeCents } from "@/lib/services/pricing";
import { formatCents } from "@/lib/format";

export function BorrowWidget({
  inventoryItemId,
  ratePerWeekCents,
  depositCents,
  canBorrow,
  blockedReason,
  creditsAvailable = 0,
}: {
  inventoryItemId: string;
  ratePerWeekCents: number;
  depositCents: number;
  canBorrow: boolean;
  blockedReason?: string;
  creditsAvailable?: number;
}) {
  const router = useRouter();
  const [periodDays, setPeriodDays] = useState(RENTAL_PERIODS[0].days);
  const [useCredit, setUseCredit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const quoted = quoteRentalFeeCents(ratePerWeekCents, periodDays);
  const effectiveFee = useCredit ? 0 : quoted;

  if (!canBorrow) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        {blockedReason === "subscription" ? (
          <>
            You need an active membership to borrow.{" "}
            <Link href="/subscribe" className="font-medium text-brand-600 hover:underline">
              View plans
            </Link>
          </>
        ) : (
          (blockedReason ?? "This item can't be borrowed right now.")
        )}
      </div>
    );
  }

  async function request() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/rentals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryItemId, periodDays, useCredit }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not send the request.");
      return;
    }
    router.push("/my-rentals");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="text-sm font-medium text-slate-700">Choose a rental period</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {RENTAL_PERIODS.map((p) => {
          const active = p.days === periodDays;
          return (
            <button
              key={p.days}
              onClick={() => setPeriodDays(p.days)}
              className={`rounded-md border px-2 py-2 text-center text-sm transition ${
                active
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-slate-500">
                {formatCents(quoteRentalFeeCents(ratePerWeekCents, p.days))}
              </div>
            </button>
          );
        })}
      </div>

      {creditsAvailable > 0 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={useCredit}
            onChange={(e) => setUseCredit(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Use a monthly credit to waive the rental fee ({creditsAvailable}{" "}
          available)
        </label>
      )}

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Rental fee</dt>
          <dd className="font-medium text-slate-900">
            {useCredit ? (
              <>
                <span className="text-slate-400 line-through">
                  {formatCents(quoted)}
                </span>{" "}
                {formatCents(0)}
              </>
            ) : (
              formatCents(effectiveFee)
            )}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Refundable deposit</dt>
          <dd className="text-slate-600">{formatCents(depositCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Shipping</dt>
          <dd className="text-slate-600">billed at each leg</dd>
        </div>
      </dl>

      <button
        onClick={request}
        disabled={loading}
        className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Request to borrow"}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        The owner reviews your request. You&apos;re only charged once they
        approve.
      </p>
    </div>
  );
}
