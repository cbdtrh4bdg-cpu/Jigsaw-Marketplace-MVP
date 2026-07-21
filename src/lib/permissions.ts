import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/** For pages: returns the signed-in user or redirects to /login. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

/** For pages: returns an admin user or redirects. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "ADMIN") redirect("/browse");
  return user;
}

/** For API routes: returns the user or null (caller returns 401). */
export async function getApiUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return (session?.user as SessionUser) ?? null;
}

/**
 * Active-subscription gate. Returns the subscription or null.
 */
export async function getActiveSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status !== "ACTIVE") return null;
  if (sub.currentPeriodEnd < new Date()) return null;
  return sub;
}

/** For pages: requires an active subscription or redirects to /subscribe. */
export async function requireSubscription(userId: string) {
  const sub = await getActiveSubscription(userId);
  if (!sub) redirect("/subscribe");
  return sub;
}
