// Central, tunable business config. Kept in one place so pricing/policy changes
// don't require touching call sites.

export type ShippingPolicy = "borrower_both" | "subsidized" | "split";

export const shippingPolicy: ShippingPolicy =
  (process.env.SHIPPING_POLICY as ShippingPolicy) || "borrower_both";

// Selectable rental periods offered to borrowers.
export interface RentalPeriodOption {
  days: number;
  label: string;
}

export const RENTAL_PERIODS: RentalPeriodOption[] = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
];

export const ALLOWED_PERIOD_DAYS = RENTAL_PERIODS.map((p) => p.days);

// Flat simulated shipping cost per leg (cents). The real provider computes this.
export const SIMULATED_SHIPPING_BASE_CENTS = 599;
