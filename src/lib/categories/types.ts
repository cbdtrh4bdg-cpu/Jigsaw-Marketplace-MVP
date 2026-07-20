import { z } from "zod";
import type { Category } from "@prisma/client";

/**
 * A CategoryModule is the ONLY category-aware code in the app. Everything else
 * (rentals, deposits, shipping, revenue share, reviews, favorites) references
 * CatalogItem/InventoryItem generically. Adding board/card games = registering
 * another module, not a schema migration.
 */
export interface BrowseFilter {
  key: string; // attribute key to filter on
  label: string;
  type: "range" | "select";
  options?: { label: string; value: string }[]; // for select
}

export interface SurveyField {
  key: "timeToCompleteHours" | "difficultyRating" | "enjoymentRating";
  label: string;
  help?: string;
}

export interface CategoryModule<TAttributes = Record<string, unknown>> {
  category: Category;
  label: string; // human singular, e.g. "Jigsaw Puzzle"
  labelPlural: string;
  // Validates & types the CatalogItem.attributes JSON.
  attributeSchema: z.ZodType<TAttributes>;
  // Short summary line for a listing card, from validated attributes.
  summarize: (attrs: TAttributes) => string;
  // Sensible default owner rate (cents/week) derived from attributes.
  defaultRatePerWeekCents: (attrs: TAttributes) => number;
  defaultDepositCents: (attrs: TAttributes) => number;
  // Browse filters surfaced in the UI.
  browseFilters: BrowseFilter[];
  // Return-time condition-proof prompt (category-aware).
  conditionProofPrompt: string;
  // Completion-survey fields (labels adapt per category).
  surveyFields: SurveyField[];
}
