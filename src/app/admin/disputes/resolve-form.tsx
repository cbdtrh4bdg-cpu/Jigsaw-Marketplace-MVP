"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveDisputeForm({
  rentalId,
  depositCents,
}: {
  rentalId: string;
  depositCents: number;
}) {
  const router = useRouter();
  const [forfeitDollars, setForfeitDollars] = useState("0");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/disputes/${rentalId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forfeitCents: Math.round(parseFloat(forfeitDollars || "0") * 100),
        notes: notes || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not resolve");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-slate-600">
            Forfeit from deposit (max ${(depositCents / 100).toFixed(2)})
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={depositCents / 100}
            value={forfeitDollars}
            onChange={(e) => setForfeitDollars(e.target.value)}
            className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="block text-slate-600">Resolution notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 3 pieces missing, partial forfeit"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Resolving…" : "Resolve & complete"}
        </button>
      </div>
    </div>
  );
}
