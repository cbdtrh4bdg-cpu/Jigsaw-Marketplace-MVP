import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";

const links = [
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/payouts", label: "Payouts" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // redirects non-admins
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-amber-800">Admin</span>
            <nav className="flex gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link href="/browse" className="text-sm font-medium text-amber-700 hover:underline">
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
