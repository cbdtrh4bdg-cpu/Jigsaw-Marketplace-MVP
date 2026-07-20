import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
}

/** Require an authenticated user; throws 401 otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Authentication required", 401);
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

/**
 * Require an active subscription — the gate for browsing and borrowing.
 * Returns the subscription so callers can inspect credits.
 */
export async function requireSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!sub || !sub.active || sub.currentPeriodEnd < new Date()) {
    throw new AuthError("An active subscription is required", 402);
  }
  return sub;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return Boolean(sub?.active && sub.currentPeriodEnd >= new Date());
}
