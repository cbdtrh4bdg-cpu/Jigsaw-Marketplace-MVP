import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import { handle } from "@/lib/api";
import { signupSchema } from "@/lib/validation";

export const POST = handle(async (req: NextRequest) => {
  const body = signupSchema.parse(await req.json());
  const email = body.email.toLowerCase();
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("User")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from("User")
    .insert({
      email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
    })
    .select("id, email, name")
    .single();
  if (error) throw new Error(`Signup failed: ${error.message}`);

  return NextResponse.json({ user: data }, { status: 201 });
});
