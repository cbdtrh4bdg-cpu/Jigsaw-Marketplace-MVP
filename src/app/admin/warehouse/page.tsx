import { prisma } from "@/lib/db";
import { getCategoryModule } from "@/lib/categories";
import { formatCents, titleCase } from "@/lib/format";
import { ListingForm } from "@/components/listing-form";

export const dynamic = "force-dynamic";

export default async function AdminWarehousePage() {
  const items = await prisma.inventoryItem.findMany({
    where: { source: "WAREHOUSE" },
    include: { catalogItem: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-slate-900">Warehouse inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform-owned copies. These appear in the shared library alongside
          community listings.
        </p>

        {items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No warehouse inventory yet. Add one on the right.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const mod = getCategoryModule(item.catalogItem.category);
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.catalogItem.title}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {mod.summarizeAttributes(
                          item.catalogItem.attributes as Record<string, unknown>,
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCents(item.ratePerWeekCents)}/wk
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {titleCase(item.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Add warehouse copy
        </h2>
        <ListingForm
          endpoint="/api/admin/warehouse"
          submitLabel="Add to warehouse"
          redirectTo="/admin/warehouse"
        />
      </div>
    </div>
  );
}
