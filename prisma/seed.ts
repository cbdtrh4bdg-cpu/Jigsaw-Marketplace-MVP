import { PrismaClient, type Category } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getCategoryModule } from "../src/lib/categories";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password12345";

async function upsertUser(opts: {
  email: string;
  name: string;
  role?: "MEMBER" | "ADMIN";
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, role: opts.role ?? "MEMBER" },
    create: {
      email: opts.email,
      name: opts.name,
      role: opts.role ?? "MEMBER",
      passwordHash,
      address: {
        line1: "123 Puzzle Ln",
        city: "Portland",
        region: "OR",
        postalCode: "97201",
        country: "US",
      },
    },
  });
}

async function upsertPlan(opts: {
  name: string;
  monthlyPriceCents: number;
  monthlyCredits: number;
  earlyAccess?: boolean;
}) {
  return prisma.subscriptionPlan.upsert({
    where: { name: opts.name },
    update: {
      monthlyPriceCents: opts.monthlyPriceCents,
      monthlyCredits: opts.monthlyCredits,
      earlyAccess: opts.earlyAccess ?? false,
    },
    create: {
      name: opts.name,
      monthlyPriceCents: opts.monthlyPriceCents,
      monthlyCredits: opts.monthlyCredits,
      earlyAccess: opts.earlyAccess ?? false,
    },
  });
}

// Idempotent listing seed: reuse a catalog title, and only create a copy for
// the owner if they don't already have one for that title.
async function seedListing(opts: {
  ownerId: string | null;
  category: Category;
  title: string;
  brand: string;
  attributes: Record<string, unknown>;
  imageUrl?: string;
  condition?: string;
}) {
  const mod = getCategoryModule(opts.category);
  const catalogItem =
    (await prisma.catalogItem.findFirst({
      where: { category: opts.category, title: opts.title, brand: opts.brand },
    })) ??
    (await prisma.catalogItem.create({
      data: {
        category: opts.category,
        title: opts.title,
        brand: opts.brand,
        imageUrl: opts.imageUrl,
        attributes: opts.attributes as object,
      },
    }));

  const existingCopy = await prisma.inventoryItem.findFirst({
    where: { catalogItemId: catalogItem.id, ownerId: opts.ownerId },
  });
  if (existingCopy) return existingCopy;

  return prisma.inventoryItem.create({
    data: {
      catalogItemId: catalogItem.id,
      source: opts.ownerId ? "USER" : "WAREHOUSE",
      ownerId: opts.ownerId,
      condition: opts.condition ?? "Good",
      ratePerWeekCents: mod.defaultRatePerWeekCents(opts.attributes),
      depositCents: mod.defaultDepositCents(opts.attributes),
    },
  });
}

async function main() {
  console.log("Seeding…");

  const admin = await upsertUser({
    email: "admin@puzzleshare.test",
    name: "Ada Admin",
    role: "ADMIN",
  });
  const alice = await upsertUser({
    email: "alice@puzzleshare.test",
    name: "Alice Lender",
  });
  const bob = await upsertUser({
    email: "bob@puzzleshare.test",
    name: "Bob Borrower",
  });

  await upsertPlan({ name: "Starter", monthlyPriceCents: 700, monthlyCredits: 0 });
  await upsertPlan({ name: "Plus", monthlyPriceCents: 1400, monthlyCredits: 1 });
  await upsertPlan({
    name: "Pro",
    monthlyPriceCents: 2400,
    monthlyCredits: 3,
    earlyAccess: true,
  });

  // Alice lists a few puzzles (P2P).
  await seedListing({
    ownerId: alice.id,
    category: "JIGSAW_PUZZLE",
    title: "Starry Night",
    brand: "Ravensburger",
    attributes: { pieceCount: 1000 },
    condition: "Like New",
  });
  await seedListing({
    ownerId: alice.id,
    category: "JIGSAW_PUZZLE",
    title: "Cozy Cabin",
    brand: "Buffalo Games",
    attributes: { pieceCount: 500 },
  });
  await seedListing({
    ownerId: alice.id,
    category: "JIGSAW_PUZZLE",
    title: "World Map",
    brand: "White Mountain",
    attributes: { pieceCount: 2000 },
    condition: "Good",
  });

  // Bob lists one too, so each user sees the other's inventory.
  await seedListing({
    ownerId: bob.id,
    category: "JIGSAW_PUZZLE",
    title: "Autumn Forest",
    brand: "Springbok",
    attributes: { pieceCount: 750 },
  });

  console.log("Seed complete.");
  console.log(`  Admin:  admin@puzzleshare.test / ${DEMO_PASSWORD}`);
  console.log(`  Alice:  alice@puzzleshare.test / ${DEMO_PASSWORD}`);
  console.log(`  Bob:    bob@puzzleshare.test   / ${DEMO_PASSWORD}`);
  console.log(`  (ids) admin=${admin.id} alice=${alice.id} bob=${bob.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
