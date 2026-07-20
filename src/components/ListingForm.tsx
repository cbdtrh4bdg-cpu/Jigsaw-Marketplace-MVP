"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@prisma/client";
import { getCategoryModule } from "@/lib/categories";
import { Button, Field, Input, Select } from "@/components/ui";

// endpoint differs for member vs. admin/warehouse listings.
export function ListingForm({
  category = Category.JIGSAW_PUZZLE,
  endpoint = "/api/listings",
  submitLabel = "List puzzle",
}: {
  category?: Category;
  endpoint?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const mod = getCategoryModule(category);
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [condition, setCondition] = useState("");
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function coerceAttributes(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of mod.formFields) {
      const raw = attrs[f.key];
      if (raw === undefined || raw === "") continue;
      out[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    return out;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        title,
        brand: brand || undefined,
        imageUrl: imageUrl || undefined,
        condition: condition || undefined,
        attributes: coerceAttributes(),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the listing");
      return;
    }
    setTitle("");
    setBrand("");
    setImageUrl("");
    setCondition("");
    setAttrs({});
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Brand">
        <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      {mod.formFields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.type === "select" ? (
            <Select
              value={attrs[f.key] ?? ""}
              onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type === "number" ? "number" : "text"}
              value={attrs[f.key] ?? ""}
              required={f.required}
              onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}
            />
          )}
        </Field>
      ))}
      <Field label="Image URL">
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </Field>
      <Field label="Condition notes">
        <Input value={condition} onChange={(e) => setCondition(e.target.value)} />
      </Field>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
