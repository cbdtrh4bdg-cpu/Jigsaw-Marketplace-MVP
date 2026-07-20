import { Role, type SubscriptionRow, type SubscriptionPlanRow } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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

async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("Subscription")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (data as SubscriptionRow | null) ?? null;
}

function isActive(sub: SubscriptionRow | null): boolean {
  return Boolean(sub?.active && new Date(sub.currentPeriodEnd) >= new Date());
}

/**
 * Require an active subscription — the gate for browsing and borrowing.
 * Returns the subscription (with plan) so callers can inspect credits.
 */
export async function requireSubscription(userId: string) {
  const sub = await fetchSubscription(userId);
  if (!isActive(sub)) {
    throw new AuthError("An active subscription is required", 402);
  }
  const { data: plan } = await supabaseAdmin()
    .from("SubscriptionPlan")
    .select("*")
    .eq("id", sub!.planId)
    .maybeSingle();
  return { ...sub!, plan: plan as SubscriptionPlanRow | null };
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  return isActive(await fetchSubscription(userId));
}
