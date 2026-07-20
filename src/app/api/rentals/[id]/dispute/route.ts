import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { disputeSchema } from "@/lib/validation";
import { openDispute } from "@/lib/services/rentals";

export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = disputeSchema.parse(await req.json());
    const rental = await openDispute(id, { id: user.id, role: user.role }, body);
    return NextResponse.json({ rental });
  },
);
