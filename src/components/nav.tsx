"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/browse", label: "Browse" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/my-rentals", label: "My Rentals" },
  { href: "/my-loans", label: "My Loans" },
  { href: "/subscribe", label: "Subscription" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/browse" className="text-lg font-bold text-brand-700">
            PuzzleShare
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin/warehouse"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-50 text-amber-700"
                    : "text-amber-600 hover:bg-amber-50"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {session?.user?.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
