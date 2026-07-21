import type { Category } from "@prisma/client";
import type { z } from "zod";

// A category module encapsulates everything category-specific about a product
// type. The rest of the app (rentals, deposits, shipping, revenue share, …) is
// category-agnostic and only ever talks to this interface — so adding board or
// card games later is a new module + seed data, not a schema change.
export interface AttributeField {
  name: string;
  label: string;
  type: "number" | "text";
  placeholder?: string;
  required?: boolean;
}

export interface CategoryModule {
  /** Matches the Prisma `Category` enum value. */
  key: Category;
  label: string;
  pluralLabel: string;

  /** Zod schema validating the `attributes` JSON blob for this category. */
  attributesSchema: z.ZodTypeAny;

  /** Fields rendered on the "list an item" form for this category. */
  attributeFields: AttributeField[];

  /** One-line human summary of an item's attributes, e.g. "1000 pieces". */
  summarizeAttributes: (attrs: Record<string, unknown>) => string;

  /** Sensible default weekly rate (cents) derived from attributes. */
  defaultRatePerWeekCents: (attrs: Record<string, unknown>) => number;

  /** Sensible default refundable deposit (cents) derived from attributes. */
  defaultDepositCents: (attrs: Record<string, unknown>) => number;

  /** Prompt shown when the borrower must upload return-condition proof. */
  conditionProofPrompt: string;

  /** Label for the completion-survey "time" field. */
  completionTimeLabel: string;
}
