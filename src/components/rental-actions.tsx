"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "approve" | "decline" | "cancel";

const labels: Record<Action, string> = {
  approve: "Approve",
  decline: "Decline",
  cancel: "Cancel request",
};

const styles: Record<Action, string> = {
  approve: "bg-brand-600 text-white hover:bg-brand-700",
  decline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  cancel: "border border-slate-300 text-slate-700 hover:bg-slate-50",
};

export function RentalActionButton({
  rentalId,
  action,
}: {
  rentalId: string;
  action: Action;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/rentals/${rentalId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={run}
        disabled={loading}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${styles[action]}`}
      >
        {loading ? "…" : labels[action]}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
