"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubscribeButton({
  planId,
  current,
}: {
  planId: string;
  current: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function subscribe() {
    setLoading(true);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      className={`mt-4 w-full rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
        current
          ? "border border-brand-300 bg-brand-50 text-brand-700"
          : "bg-brand-600 text-white hover:bg-brand-700"
      }`}
    >
      {loading ? "Processing…" : current ? "Switch to this plan" : "Choose plan"}
    </button>
  );
}
