/** Format an integer number of cents as USD. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Round to whole cents (guards against floating-point payout math). */
export function roundCents(value: number): number {
  return Math.round(value);
}
