import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { handle } from "@/lib/api";
import { signupSchema } from "@/lib/validation";

export const POST = handle(async (req: NextRequest) => {
  const body = signupSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
    },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
});
