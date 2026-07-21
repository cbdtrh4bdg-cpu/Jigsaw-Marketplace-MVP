import { z } from "zod";
import type { CategoryModule } from "./types";

const attributesSchema = z.object({
  pieceCount: z.coerce
    .number()
    .int()
    .min(2, "Piece count must be at least 2")
    .max(60000, "That is a suspiciously large puzzle"),
});

export const jigsawPuzzleModule: CategoryModule = {
  key: "JIGSAW_PUZZLE",
  label: "Jigsaw Puzzle",
  pluralLabel: "Jigsaw Puzzles",

  attributesSchema,
  attributeFields: [
    {
      name: "pieceCount",
      label: "Piece count",
      type: "number",
      placeholder: "1000",
      required: true,
    },
  ],

  summarizeAttributes: (attrs) => {
    const pieceCount = Number(attrs.pieceCount);
    return Number.isFinite(pieceCount)
      ? `${pieceCount.toLocaleString()} pieces`
      : "Puzzle";
  },

  // Bigger puzzles are worth a little more per week and warrant a larger deposit.
  defaultRatePerWeekCents: (attrs) => {
    const pieces = Number(attrs.pieceCount) || 500;
    // ~$2 base + $1 per 500 pieces, rounded to the nearest quarter.
    const dollars = 2 + pieces / 500;
    return Math.round(dollars * 4) * 25;
  },
  defaultDepositCents: (attrs) => {
    const pieces = Number(attrs.pieceCount) || 500;
    // ~$8 base + $2 per 500 pieces.
    const dollars = 8 + (pieces / 500) * 2;
    return Math.round(dollars) * 100;
  },

  conditionProofPrompt:
    "Upload a photo of the fully assembled puzzle so the owner can confirm all pieces are present.",
  completionTimeLabel: "How many hours did it take you to complete?",
};
