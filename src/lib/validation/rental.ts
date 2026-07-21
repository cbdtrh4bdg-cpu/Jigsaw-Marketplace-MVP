import { z } from "zod";
import { ALLOWED_PERIOD_DAYS } from "@/lib/config";

export const rentalRequestSchema = z.object({
  inventoryItemId: z.string().min(1),
  periodDays: z.coerce
    .number()
    .int()
    .refine((d) => ALLOWED_PERIOD_DAYS.includes(d), "Invalid rental period"),
  useCredit: z.boolean().optional().default(false),
});

export const subscribeSchema = z.object({
  planId: z.string().min(1),
});

export type RentalRequestInput = z.infer<typeof rentalRequestSchema>;
