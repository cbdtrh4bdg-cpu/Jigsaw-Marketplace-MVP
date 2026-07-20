import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import type { CurrentUser } from "@/lib/permissions";

/** For server component pages: redirect to login instead of throwing. */
export async function requireUserPage(callbackUrl?: string): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      callbackUrl
        ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/login",
    );
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requireUserPage("/admin/warehouse");
  if (user.role !== Role.ADMIN) redirect("/");
  return user;
}
