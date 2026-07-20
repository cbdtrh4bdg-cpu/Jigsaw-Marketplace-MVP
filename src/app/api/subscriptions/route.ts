import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { subscribe } from "@/lib/services/subscriptions";

const bodySchema = z.object({ planKey: z.string().min(1) });

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const { planKey } = bodySchema.parse(await req.json());
  const subscription = await subscribe(user.id, planKey);
  return NextResponse.json({ subscription }, { status: 201 });
});
