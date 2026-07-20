"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function FavoriteButton({
  catalogItemId,
  initialFavorited,
}: {
  catalogItemId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogItemId }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setFavorited(data.favorited);
    }
  }

  return (
    <Button variant="secondary" onClick={toggle} disabled={loading}>
      {favorited ? "★ Wishlisted" : "☆ Add to wishlist"}
    </Button>
  );
}
