import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { subscribeSchema } from "@/lib/validation/rental";
import { subscribeUser } from "@/lib/services/subscriptions";

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    const subscription = await subscribeUser(user.id, parsed.data.planId);
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not subscribe" },
      { status: 400 },
    );
  }
}
