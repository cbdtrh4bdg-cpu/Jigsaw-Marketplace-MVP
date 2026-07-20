import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { experienceSchema } from "@/lib/validation";
import { submitExperience } from "@/lib/services/rentals";

export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = experienceSchema.parse(await req.json());
    const experience = await submitExperience(
      id,
      { id: user.id, role: user.role },
      body,
    );
    return NextResponse.json({ experience });
  },
);
