import type { RentalStatus } from "@prisma/client";
import { titleCase } from "@/lib/format";

const styles: Record<RentalStatus, string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-indigo-100 text-indigo-700",
  DECLINED: "bg-slate-200 text-slate-600",
  CANCELED: "bg-slate-200 text-slate-600",
  SHIPPED_TO_BORROWER: "bg-violet-100 text-violet-700",
  IN_HAND: "bg-emerald-100 text-emerald-700",
  RETURN_SHIPPED: "bg-amber-100 text-amber-700",
  RETURNED: "bg-teal-100 text-teal-700",
  COMPLETED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {titleCase(status)}
    </span>
  );
}
