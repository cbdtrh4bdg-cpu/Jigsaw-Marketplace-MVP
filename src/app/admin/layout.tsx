import Link from "next/link";
import { requireAdminPage } from "@/lib/pageAuth";

const TABS = [
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/rentals", label: "Rentals" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/payouts", label: "Payouts" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <div>
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-t-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
