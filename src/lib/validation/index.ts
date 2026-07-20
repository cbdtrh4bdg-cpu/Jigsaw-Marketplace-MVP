import { z } from "zod";
import { Category } from "@/lib/db-types";
import { RENTAL_PERIOD_DAYS } from "@/lib/config";
import { getCategoryModule } from "@/lib/categories";

export const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

// A listing pairs catalog metadata with a physical copy. `attributes` is
// validated by the category module.
export const listingSchema = z
  .object({
    category: z.nativeEnum(Category).default(Category.JIGSAW_PUZZLE),
    title: z.string().min(1).max(200),
    brand: z.string().max(100).optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
    attributes: z.record(z.unknown()).default({}),
    condition: z.string().max(500).optional(),
    ratePerWeekCents: z.number().int().min(0).max(100000).optional(),
    depositCents: z.number().int().min(0).max(1000000).optional(),
  })
  .superRefine((val, ctx) => {
    const mod = getCategoryModule(val.category);
    const parsed = mod.attributeSchema.safeParse(val.attributes);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attributes"],
        message: `Invalid attributes for ${mod.label}: ${parsed.error.issues
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join(", ")}`,
      });
    }
  });

export const rentalRequestSchema = z.object({
  inventoryItemId: z.string().min(1),
  periodDays: z.number().int().refine(
    (d) => (RENTAL_PERIOD_DAYS as readonly number[]).includes(d),
    { message: "Unsupported rental period" },
  ),
});

export const conditionProofSchema = z.object({
  imageUrl: z.string().min(1),
  note: z.string().max(500).optional(),
});

export const experienceSchema = z.object({
  timeToCompleteHours: z.number().min(0).max(10000).optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  enjoymentRating: z.number().int().min(1).max(5).optional(),
  missingPiecesReported: z.number().int().min(0).max(100000).default(0),
  notes: z.string().max(1000).optional(),
});

export const disputeSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const resolveDisputeSchema = z.object({
  resolution: z.string().min(1).max(1000),
  forfeitCents: z.number().int().min(0).max(1000000),
});

export const reviewSchema = z.object({
  catalogItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const warehouseListingSchema = listingSchema;

export type ListingInput = z.infer<typeof listingSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
