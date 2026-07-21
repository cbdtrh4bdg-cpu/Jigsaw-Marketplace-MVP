"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function ReturnForm({
  rentalId,
  proofPrompt,
  timeLabel,
}: {
  rentalId: string;
  proofPrompt: string;
  timeLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/rentals/${rentalId}/return`, {
      method: "POST",
      body: form,
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit.");
      return;
    }
    router.push("/my-rentals");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Completion photo <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 mt-0.5 text-xs text-slate-500">{proofPrompt}</p>
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            {timeLabel}
          </label>
          <input
            type="number"
            name="timeToCompleteHours"
            step="0.5"
            min="0"
            placeholder="e.g. 6"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Difficulty (1–5)
          </label>
          <select name="difficultyRating" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Enjoyment (1–5)
          </label>
          <select name="enjoymentRating" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Missing pieces
        </label>
        <input
          type="number"
          name="missingPiecesReported"
          min="0"
          defaultValue="0"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">
          Be honest — this is shared with the owner and affects your deposit.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea name="notes" rows={3} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit & ship back"}
      </button>
    </form>
  );
}
