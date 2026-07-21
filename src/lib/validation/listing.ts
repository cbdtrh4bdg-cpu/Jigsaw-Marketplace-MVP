import { z } from "zod";
import { getCategoryModule, isCategorySupported } from "@/lib/categories";
import type { Category } from "@prisma/client";

const categoryEnum = z.enum(["JIGSAW_PUZZLE", "BOARD_GAME", "CARD_GAME"]);

// Base fields shared by every listing. `attributes` is validated per-category
// by the matching category module.
export const listingSchema = z
  .object({
    category: categoryEnum,
    title: z.string().min(1, "Title is required").max(200),
    brand: z.string().max(120).optional().or(z.literal("")),
    imageUrl: z.string().url().max(1000).optional().or(z.literal("")),
    condition: z.string().min(1).max(60).default("Good"),
    attributes: z.record(z.unknown()).default({}),
    // Optional owner overrides; category module supplies defaults if omitted.
    ratePerWeekCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
    depositCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (!isCategorySupported(data.category as Category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "That category is not available yet",
      });
      return;
    }
    const mod = getCategoryModule(data.category as Category);
    const result = mod.attributesSchema.safeParse(data.attributes);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attributes", ...issue.path],
          message: issue.message,
        });
      }
    } else {
      // Normalize/coerce attributes (e.g. "1000" -> 1000).
      data.attributes = result.data as Record<string, unknown>;
    }
  });

export type ListingInput = z.infer<typeof listingSchema>;
