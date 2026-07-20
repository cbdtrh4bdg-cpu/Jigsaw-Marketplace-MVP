import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";

type RouteCtx = { params: Promise<{ id: string }> };
type Actor = { id: string; role: import("@/lib/db-types").Role };

/**
 * Build a POST handler for a simple rental transition that only needs the
 * rental id + the acting user. Keeps the many action routes to one line each.
 */
export function rentalActionRoute(
  action: (rentalId: string, user: Actor) => Promise<unknown>,
) {
  return handle(async (_req: Request, ctx: RouteCtx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const rental = await action(id, { id: user.id, role: user.role });
    return NextResponse.json({ rental });
  });
}
