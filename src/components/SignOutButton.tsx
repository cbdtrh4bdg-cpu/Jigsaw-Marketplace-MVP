"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-slate-500 hover:text-red-600"
    >
      Sign out
    </button>
  );
}
