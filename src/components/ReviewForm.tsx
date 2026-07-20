"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Select, Textarea } from "@/components/ui";

export function ReviewForm({
  catalogItemId,
  initialRating,
  initialComment,
}: {
  catalogItemId: string;
  initialRating?: number;
  initialComment?: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(String(initialRating ?? 5));
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogItemId, rating: Number(rating), comment }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit review");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 p-4">
      <p className="mb-3 text-sm font-medium">Leave a review</p>
      <Field label="Rating">
        <Select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Comment">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />
      </Field>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Submit review"}
      </Button>
    </form>
  );
}
