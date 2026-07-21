"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listCategoryModules } from "@/lib/categories";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/**
 * Shared create-a-listing form. `endpoint` differs for P2P (/api/listings)
 * vs. warehouse (/api/admin/warehouse); everything else is identical, driven
 * by the registered category modules.
 */
export function ListingForm({
  endpoint,
  submitLabel,
  redirectTo,
}: {
  endpoint: string;
  submitLabel: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const modules = useMemo(() => listCategoryModules(), []);
  const [category, setCategory] = useState(modules[0]?.key ?? "JIGSAW_PUZZLE");
  const activeModule = modules.find((m) => m.key === category) ?? modules[0];

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [condition, setCondition] = useState("Good");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body: Record<string, unknown> = {
      category,
      title,
      brand: brand || undefined,
      imageUrl: imageUrl || undefined,
      condition,
      attributes,
    };
    if (rate) body.ratePerWeekCents = Math.round(parseFloat(rate) * 100);
    if (deposit) body.depositCents = Math.round(parseFloat(deposit) * 100);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the listing.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Category</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as typeof category);
            setAttributes({});
          }}
          className={inputClass}
        >
          {modules.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Starry Night"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Brand <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Ravensburger"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className={inputClass}
          >
            <option>Like New</option>
            <option>Good</option>
            <option>Fair</option>
          </select>
        </div>
      </div>

      {activeModule?.attributeFields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-slate-700">
            {field.label}
          </label>
          <input
            type={field.type === "number" ? "number" : "text"}
            required={field.required}
            placeholder={field.placeholder}
            value={attributes[field.name] ?? ""}
            onChange={(e) =>
              setAttributes((a) => ({ ...a, [field.name]: e.target.value }))
            }
            className={inputClass}
          />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Image URL <span className="text-slate-400">(optional)</span>
        </label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Rate / week <span className="text-slate-400">($, optional)</span>
          </label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="auto"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Deposit <span className="text-slate-400">($, optional)</span>
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            placeholder="auto"
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Leave rate and deposit blank to use sensible defaults based on the
        item&apos;s size.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
