"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId, rating, comment: comment || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit review");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Leave a review
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">
          Rating
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "…" : "Submit"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
