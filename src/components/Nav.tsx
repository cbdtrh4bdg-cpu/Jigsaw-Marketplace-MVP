import Link from "next/link";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-700">
          🧩 Piece Together
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/browse" className="hover:text-brand-700">Browse</Link>
              <Link href="/my-listings" className="hover:text-brand-700">My Listings</Link>
              <Link href="/my-rentals" className="hover:text-brand-700">My Rentals</Link>
              <Link href="/my-loans" className="hover:text-brand-700">My Loans</Link>
              <Link href="/subscribe" className="hover:text-brand-700">Subscription</Link>
              {user.role === Role.ADMIN ? (
                <Link href="/admin/warehouse" className="font-medium text-brand-700">
                  Admin
                </Link>
              ) : null}
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-700">Log in</Link>
              <Link
                href="/signup"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
