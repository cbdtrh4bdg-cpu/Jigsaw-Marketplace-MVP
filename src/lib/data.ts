import { supabaseAdmin } from "@/lib/supabase";
import type {
  CatalogItemRow,
  ConditionProofRow,
  DepositRow,
  DisputeRow,
  InventoryItemRow,
  RentalExperienceRow,
  RentalRow,
  ReviewRow,
  ShipmentRow,
  UserRow,
} from "@/lib/db-types";

/**
 * Data-access helpers over the Supabase client.
 *
 * We assemble related rows with explicit batch queries (rather than PostgREST
 * embedded selects) so the shapes are predictable and the code stays portable
 * across Supabase versions. Batch fetching keeps the rental lists free of N+1.
 */

function db() {
  return supabaseAdmin();
}

async function fail<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
}

function keyBy<T, K extends keyof T>(rows: T[], k: K): Map<T[K], T> {
  const m = new Map<T[K], T>();
  for (const r of rows) m.set(r[k], r);
  return m;
}

function groupBy<T, K extends keyof T>(rows: T[], k: K): Map<T[K], T[]> {
  const m = new Map<T[K], T[]>();
  for (const r of rows) {
    const key = r[k];
    (m.get(key) ?? m.set(key, []).get(key)!).push(r);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Assembled rental shape (mirrors the old Prisma include)
// ---------------------------------------------------------------------------

export interface FullRental extends RentalRow {
  inventoryItem: InventoryItemRow & {
    catalogItem: CatalogItemRow;
    owner: UserRow | null;
  };
  borrower: UserRow;
  deposit: DepositRow | null;
  shipments: ShipmentRow[];
  conditionProof: ConditionProofRow | null;
  experience: RentalExperienceRow | null;
  dispute: DisputeRow | null;
}

async function assembleRentals(rentals: RentalRow[]): Promise<FullRental[]> {
  if (rentals.length === 0) return [];
  const rentalIds = rentals.map((r) => r.id);
  const inventoryIds = [...new Set(rentals.map((r) => r.inventoryItemId))];

  const inventory = await fail(
    db().from("InventoryItem").select("*").in("id", inventoryIds),
  ) as InventoryItemRow[];
  const catalogIds = [...new Set(inventory.map((i) => i.catalogItemId))];
  const ownerIds = [...new Set(inventory.map((i) => i.ownerId).filter(Boolean))] as string[];
  const borrowerIds = [...new Set(rentals.map((r) => r.borrowerId))];
  const userIds = [...new Set([...ownerIds, ...borrowerIds])];

  const [catalog, users, deposits, shipments, proofs, experiences, disputes] =
    await Promise.all([
      fail(db().from("CatalogItem").select("*").in("id", catalogIds)) as Promise<CatalogItemRow[]>,
      userIds.length
        ? (fail(db().from("User").select("*").in("id", userIds)) as Promise<UserRow[]>)
        : Promise.resolve([] as UserRow[]),
      fail(db().from("Deposit").select("*").in("rentalId", rentalIds)) as Promise<DepositRow[]>,
      fail(db().from("Shipment").select("*").in("rentalId", rentalIds)) as Promise<ShipmentRow[]>,
      fail(db().from("ConditionProof").select("*").in("rentalId", rentalIds)) as Promise<ConditionProofRow[]>,
      fail(db().from("RentalExperience").select("*").in("rentalId", rentalIds)) as Promise<RentalExperienceRow[]>,
      fail(db().from("Dispute").select("*").in("rentalId", rentalIds)) as Promise<DisputeRow[]>,
    ]);

  const catalogById = keyBy(catalog, "id");
  const userById = keyBy(users, "id");
  const invById = keyBy(inventory, "id");
  const depByRental = keyBy(deposits, "rentalId");
  const shipByRental = groupBy(shipments, "rentalId");
  const proofByRental = keyBy(proofs, "rentalId");
  const expByRental = keyBy(experiences, "rentalId");
  const disByRental = keyBy(disputes, "rentalId");

  return rentals.map((r) => {
    const inv = invById.get(r.inventoryItemId)!;
    return {
      ...r,
      inventoryItem: {
        ...inv,
        catalogItem: catalogById.get(inv.catalogItemId)!,
        owner: inv.ownerId ? (userById.get(inv.ownerId) ?? null) : null,
      },
      borrower: userById.get(r.borrowerId)!,
      deposit: depByRental.get(r.id) ?? null,
      shipments: shipByRental.get(r.id) ?? [],
      conditionProof: proofByRental.get(r.id) ?? null,
      experience: expByRental.get(r.id) ?? null,
      dispute: disByRental.get(r.id) ?? null,
    };
  });
}

export async function getFullRental(id: string): Promise<FullRental | null> {
  const rows = (await fail(
    db().from("Rental").select("*").eq("id", id).limit(1),
  )) as RentalRow[];
  if (rows.length === 0) return null;
  return (await assembleRentals(rows))[0];
}

export async function listFullRentalsBy(
  column: "borrowerId",
  value: string,
): Promise<FullRental[]>;
export async function listFullRentalsBy(
  column: "status",
  value: string,
): Promise<FullRental[]>;
export async function listFullRentalsBy(
  column: string,
  value: string,
): Promise<FullRental[]> {
  const rows = (await fail(
    db().from("Rental").select("*").eq(column, value).order("requestedAt", { ascending: false }),
  )) as RentalRow[];
  return assembleRentals(rows);
}

/** Rentals of copies owned by a given member (their loans). */
export async function listRentalsForOwner(ownerId: string): Promise<FullRental[]> {
  const inv = (await fail(
    db().from("InventoryItem").select("id").eq("ownerId", ownerId),
  )) as { id: string }[];
  const ids = inv.map((i) => i.id);
  if (ids.length === 0) return [];
  const rows = (await fail(
    db()
      .from("Rental")
      .select("*")
      .in("inventoryItemId", ids)
      .order("requestedAt", { ascending: false }),
  )) as RentalRow[];
  return assembleRentals(rows);
}

// ---------------------------------------------------------------------------
// Inventory + catalog for browse / listings / detail
// ---------------------------------------------------------------------------

export interface InventoryWithCatalog extends InventoryItemRow {
  catalogItem: CatalogItemRow;
  owner: UserRow | null;
}

export async function listInventoryWithCatalog(filter: {
  status?: string;
  source?: string;
  ownerId?: string;
}): Promise<InventoryWithCatalog[]> {
  let q = db().from("InventoryItem").select("*").order("createdAt", { ascending: false });
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.source) q = q.eq("source", filter.source);
  if (filter.ownerId) q = q.eq("ownerId", filter.ownerId);
  const inv = (await fail(q)) as InventoryItemRow[];
  return joinCatalogAndOwner(inv);
}

async function joinCatalogAndOwner(
  inv: InventoryItemRow[],
): Promise<InventoryWithCatalog[]> {
  if (inv.length === 0) return [];
  const catalogIds = [...new Set(inv.map((i) => i.catalogItemId))];
  const ownerIds = [...new Set(inv.map((i) => i.ownerId).filter(Boolean))] as string[];
  const [catalog, owners] = await Promise.all([
    fail(db().from("CatalogItem").select("*").in("id", catalogIds)) as Promise<CatalogItemRow[]>,
    ownerIds.length
      ? (fail(db().from("User").select("*").in("id", ownerIds)) as Promise<UserRow[]>)
      : Promise.resolve([] as UserRow[]),
  ]);
  const catalogById = keyBy(catalog, "id");
  const ownerById = keyBy(owners, "id");
  return inv.map((i) => ({
    ...i,
    catalogItem: catalogById.get(i.catalogItemId)!,
    owner: i.ownerId ? (ownerById.get(i.ownerId) ?? null) : null,
  }));
}

export async function getInventoryWithCatalog(
  id: string,
): Promise<InventoryWithCatalog | null> {
  const inv = (await fail(
    db().from("InventoryItem").select("*").eq("id", id).limit(1),
  )) as InventoryItemRow[];
  if (inv.length === 0) return null;
  return (await joinCatalogAndOwner(inv))[0];
}

export async function getInventoryItem(id: string): Promise<InventoryItemRow | null> {
  const rows = (await fail(
    db().from("InventoryItem").select("*").eq("id", id).limit(1),
  )) as InventoryItemRow[];
  return rows[0] ?? null;
}

export async function getReviewsForCatalog(
  catalogItemId: string,
): Promise<(ReviewRow & { user: UserRow | null })[]> {
  const reviews = (await fail(
    db()
      .from("Review")
      .select("*")
      .eq("catalogItemId", catalogItemId)
      .order("createdAt", { ascending: false }),
  )) as ReviewRow[];
  if (reviews.length === 0) return [];
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = (await fail(
    db().from("User").select("*").in("id", userIds),
  )) as UserRow[];
  const byId = keyBy(users, "id");
  return reviews.map((r) => ({ ...r, user: byId.get(r.userId) ?? null }));
}
