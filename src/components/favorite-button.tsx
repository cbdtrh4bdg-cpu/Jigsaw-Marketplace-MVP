"use client";

import { useState } from "react";

export function FavoriteButton({
  catalogItemId,
  initialFavorited,
  initialCount,
}: {
  catalogItemId: string;
  initialFavorited: boolean;
  initialCount: number;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogItemId }),
    });
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setFavorited(data.favorited);
    setCount((c) => c + (data.favorited ? 1 : -1));
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={favorited}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        favorited
          ? "border-rose-300 bg-rose-50 text-rose-600"
          : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span>{favorited ? "♥" : "♡"}</span>
      <span>Wishlist{count > 0 ? ` · ${count}` : ""}</span>
    </button>
  );
}
