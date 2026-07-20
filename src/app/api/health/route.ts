import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Fast "is it up + can it reach the DB" probe.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        db: "unreachable",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
