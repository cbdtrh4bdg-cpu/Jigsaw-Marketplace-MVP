"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ActionKey =
  | "approve"
  | "decline"
  | "cancel"
  | "ship"
  | "receive"
  | "markReturned"
  | "inspectComplete"
  | "inspectDispute";

interface ActionSpec {
  path: string;
  body?: unknown;
  label: string;
  primary?: boolean;
  danger?: boolean;
}

const ACTIONS: Record<ActionKey, ActionSpec> = {
  approve: { path: "approve", label: "Approve", primary: true },
  decline: { path: "decline", label: "Decline" },
  cancel: { path: "cancel", label: "Cancel request" },
  ship: { path: "ship", label: "Mark shipped", primary: true },
  receive: { path: "receive", label: "Mark received", primary: true },
  markReturned: { path: "mark-returned", label: "Mark returned", primary: true },
  inspectComplete: {
    path: "inspect",
    body: { outcome: "complete" },
    label: "Complete & refund deposit",
    primary: true,
  },
  inspectDispute: {
    path: "inspect",
    body: { outcome: "dispute" },
    label: "Open dispute",
    danger: true,
  },
};

export function RentalActionButton({
  rentalId,
  action,
}: {
  rentalId: string;
  action: ActionKey;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = ACTIONS[action];

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/rentals/${rentalId}/${spec.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec.body ?? {}),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  const cls = spec.primary
    ? "bg-brand-600 text-white hover:bg-brand-700"
    : spec.danger
      ? "border border-red-300 text-red-700 hover:bg-red-50"
      : "border border-slate-300 text-slate-700 hover:bg-slate-50";

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={run}
        disabled={loading}
        className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${cls}`}
      >
        {loading ? "…" : spec.label}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
