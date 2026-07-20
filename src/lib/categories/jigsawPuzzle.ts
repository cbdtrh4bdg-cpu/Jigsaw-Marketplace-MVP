import { z } from "zod";
import { Category } from "@/lib/db-types";
import type { CategoryModule } from "./types";

export const jigsawAttributeSchema = z.object({
  pieceCount: z.number().int().positive().max(60000),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
});

export type JigsawAttributes = z.infer<typeof jigsawAttributeSchema>;

export const jigsawPuzzleModule: CategoryModule<JigsawAttributes> = {
  category: Category.JIGSAW_PUZZLE,
  label: "Jigsaw Puzzle",
  labelPlural: "Jigsaw Puzzles",
  attributeSchema: jigsawAttributeSchema,
  summarize: (a) =>
    `${a.pieceCount.toLocaleString()} pieces${a.difficulty ? ` · ${a.difficulty}` : ""}`,
  // Bigger puzzles are worth more and are out longer; scale the rate mildly.
  defaultRatePerWeekCents: (a) => {
    if (a.pieceCount >= 3000) return 900;
    if (a.pieceCount >= 1000) return 600;
    return 400;
  },
  defaultDepositCents: (a) => (a.pieceCount >= 2000 ? 3000 : 2000),
  formFields: [
    { key: "pieceCount", label: "Piece count", type: "number", required: true },
    {
      key: "difficulty",
      label: "Difficulty",
      type: "select",
      options: [
        { label: "—", value: "" },
        { label: "Easy", value: "easy" },
        { label: "Medium", value: "medium" },
        { label: "Hard", value: "hard" },
        { label: "Expert", value: "expert" },
      ],
    },
  ],
  browseFilters: [
    {
      key: "pieceCount",
      label: "Piece count",
      type: "select",
      options: [
        { label: "Up to 500", value: "0-500" },
        { label: "501–1000", value: "501-1000" },
        { label: "1001–2000", value: "1001-2000" },
        { label: "2000+", value: "2001-100000" },
      ],
    },
    {
      key: "difficulty",
      label: "Difficulty",
      type: "select",
      options: [
        { label: "Easy", value: "easy" },
        { label: "Medium", value: "medium" },
        { label: "Hard", value: "hard" },
        { label: "Expert", value: "expert" },
      ],
    },
  ],
  conditionProofPrompt:
    "Upload a photo of the fully assembled puzzle so the lender can confirm all pieces are present before you take it apart.",
  surveyFields: [
    {
      key: "timeToCompleteHours",
      label: "Hours to complete",
      help: "Roughly how long did the puzzle take?",
    },
    { key: "difficultyRating", label: "Difficulty (1–5)" },
    { key: "enjoymentRating", label: "Enjoyment (1–5)" },
  ],
};
