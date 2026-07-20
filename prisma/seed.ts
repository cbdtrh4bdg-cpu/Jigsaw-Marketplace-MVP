import {
  PrismaClient,
  Category,
  InventorySource,
  InventoryStatus,
  RentalStatus,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function upsertUser(
  email: string,
  name: string,
  role: Role,
  address: Partial<{
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  }> = {},
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, ...address },
    create: { email, name, role, passwordHash, ...address },
  });
}

async function upsertPlan(
  key: string,
  name: string,
  priceCents: number,
  monthlyCredits: number,
) {
  return prisma.subscriptionPlan.upsert({
    where: { key },
    update: { name, priceCents, monthlyCredits },
    create: { key, name, priceCents, monthlyCredits },
  });
}

async function ensureSubscription(userId: string, planId: string, credits: number) {
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.subscription.create({
    data: {
      userId,
      planId,
      active: true,
      creditsRemaining: credits,
      currentPeriodEnd: end,
    },
  });
}

async function ensureListing(opts: {
  ownerId: string | null;
  source: InventorySource;
  title: string;
  brand: string;
  pieceCount: number;
  difficulty?: string;
  ratePerWeekCents: number;
  depositCents: number;
  imageUrl?: string;
}) {
  const catalogItem = await prisma.catalogItem.upsert({
    where: {
      category_title_brand: {
        category: Category.JIGSAW_PUZZLE,
        title: opts.title,
        brand: opts.brand,
      },
    },
    update: {},
    create: {
      category: Category.JIGSAW_PUZZLE,
      title: opts.title,
      brand: opts.brand,
      imageUrl: opts.imageUrl,
      attributes: { pieceCount: opts.pieceCount, difficulty: opts.difficulty },
    },
  });

  // One inventory copy per (catalogItem, owner) for seed idempotency.
  const existing = await prisma.inventoryItem.findFirst({
    where: { catalogItemId: catalogItem.id, ownerId: opts.ownerId },
  });
  if (existing) return { catalogItem, inventoryItem: existing };

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      catalogItemId: catalogItem.id,
      source: opts.source,
      ownerId: opts.ownerId,
      status: InventoryStatus.AVAILABLE,
      ratePerWeekCents: opts.ratePerWeekCents,
      depositCents: opts.depositCents,
    },
  });
  return { catalogItem, inventoryItem };
}

async function main() {
  // --- Users --------------------------------------------------------------
  const admin = await upsertUser("admin@piecetogether.test", "Admin", Role.ADMIN);
  const alice = await upsertUser("alice@piecetogether.test", "Alice", Role.MEMBER, {
    addressLine1: "1 Puzzle Way",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
  });
  const bob = await upsertUser("bob@piecetogether.test", "Bob", Role.MEMBER, {
    addressLine1: "42 Borrow St",
    city: "Seattle",
    state: "WA",
    postalCode: "98101",
  });
  const carol = await upsertUser("carol@piecetogether.test", "Carol", Role.MEMBER);

  // --- Plans + subscriptions ---------------------------------------------
  const starter = await upsertPlan("starter", "Starter", 0, 0);
  const plus = await upsertPlan("plus", "Plus", 999, 1);
  const pro = await upsertPlan("pro", "Pro", 1999, 3);

  await ensureSubscription(alice.id, pro.id, 3);
  await ensureSubscription(bob.id, plus.id, 1);
  await ensureSubscription(carol.id, starter.id, 0);

  // --- Alice: a small set of desirable titles ----------------------------
  const starryNight = await ensureListing({
    ownerId: alice.id,
    source: InventorySource.USER,
    title: "Starry Night",
    brand: "Ravensburger",
    pieceCount: 1000,
    difficulty: "medium",
    ratePerWeekCents: 600,
    depositCents: 2000,
  });
  const worldMap = await ensureListing({
    ownerId: alice.id,
    source: InventorySource.USER,
    title: "Antique World Map",
    brand: "Buffalo Games",
    pieceCount: 2000,
    difficulty: "hard",
    ratePerWeekCents: 800,
    depositCents: 3000,
  });

  // --- Carol: lots of unpopular listings (bloat) -------------------------
  for (let i = 1; i <= 12; i++) {
    await ensureListing({
      ownerId: carol.id,
      source: InventorySource.USER,
      title: `Generic Landscape #${i}`,
      brand: "NoName",
      pieceCount: 500,
      difficulty: "easy",
      ratePerWeekCents: 300,
      depositCents: 1500,
    });
  }

  // --- Warehouse copy -----------------------------------------------------
  await ensureListing({
    ownerId: null,
    source: InventorySource.WAREHOUSE,
    title: "Galaxy Spiral",
    brand: "Piece Together",
    pieceCount: 1500,
    difficulty: "medium",
    ratePerWeekCents: 700,
    depositCents: 2500,
  });

  // --- Demand signals: favorites, reviews, completed-rental history ------
  // These make Alice's titles genuinely "in demand" so the revenue-share
  // model has something to reward (Phase 4 verification).
  await seedFavorites(bob.id, [
    starryNight.catalogItem.id,
    worldMap.catalogItem.id,
  ]);
  await seedFavorites(carol.id, [starryNight.catalogItem.id]);
  await seedReview(bob.id, starryNight.catalogItem.id, 5, "Gorgeous, great fit.");
  await seedReview(carol.id, starryNight.catalogItem.id, 5, "Loved it.");
  await seedReview(bob.id, worldMap.catalogItem.id, 4, "Tough but fun.");

  await seedCompletedRentals(bob.id, starryNight.inventoryItem.id, 8);
  await seedCompletedRentals(bob.id, worldMap.inventoryItem.id, 4);

  console.log("Seed complete.");
  console.log(`Users: admin/alice/bob/carol @piecetogether.test (pw: ${PASSWORD})`);
}

async function seedFavorites(userId: string, catalogItemIds: string[]) {
  for (const catalogItemId of catalogItemIds) {
    await prisma.favorite.upsert({
      where: { userId_catalogItemId: { userId, catalogItemId } },
      update: {},
      create: { userId, catalogItemId },
    });
  }
}

async function seedReview(
  userId: string,
  catalogItemId: string,
  rating: number,
  comment: string,
) {
  await prisma.review.upsert({
    where: { userId_catalogItemId: { userId, catalogItemId } },
    update: { rating, comment },
    create: { userId, catalogItemId, rating, comment },
  });
}

// Fabricate historical COMPLETED rentals (data-only) to give titles a rental
// history for the popularity signal. Idempotent via a count check.
async function seedCompletedRentals(
  borrowerId: string,
  inventoryItemId: string,
  count: number,
) {
  const existing = await prisma.rental.count({
    where: { inventoryItemId, status: RentalStatus.COMPLETED },
  });
  const toCreate = Math.max(0, count - existing);
  for (let i = 0; i < toCreate; i++) {
    const now = new Date();
    await prisma.rental.create({
      data: {
        inventoryItemId,
        borrowerId,
        status: RentalStatus.COMPLETED,
        periodDays: 14,
        quotedFeeCents: 1200,
        approvedAt: now,
        dueAt: now,
        completedAt: now,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
