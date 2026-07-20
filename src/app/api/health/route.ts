import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "unknown";
  try {
    const { error } = await supabaseAdmin()
      .from("SubscriptionPlan")
      .select("id", { head: true, count: "exact" });
    db = error ? "down" : "up";
  } catch {
    db = "down";
  }
  return NextResponse.json({
    status: "ok",
    db,
    backend: "supabase",
    time: new Date().toISOString(),
  });
}
