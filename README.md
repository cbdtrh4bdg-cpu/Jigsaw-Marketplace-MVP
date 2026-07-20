# 🧩 Piece Together — Jigsaw Puzzle Marketplace

A full-stack **jigsaw puzzle rental marketplace + subscription service** built
with a **hybrid model**:

- **Peer-to-peer lending** — members list puzzles they own; subscribers browse
  everyone's inventory and request to borrow.
- **Centralized warehouse** — the platform also owns inventory it ships
  directly. `USER`-owned vs `WAREHOUSE`-owned copies are a first-class
  distinction from day one.

The catalog is **category-generic** (puzzles now; board & card games later with
no schema rewrite — see [Extensibility](#extensibility)).

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Auth.js (NextAuth) — Credentials + Prisma adapter |
| UI | Tailwind CSS |
| Validation | Zod |
| Payments / Shipping / Storage | Stubbed provider interfaces (swap for Stripe/carrier/S3) |
| Tests | Vitest (money + state-machine logic) |

## Quick start

```bash
# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env        # tweak if needed

# 3. Database — Docker (preferred) …
docker compose up -d db
#    … or a local Postgres 16 with a `jigsaw` role/db matching DATABASE_URL.

# 4. Schema + seed
npx prisma migrate dev
npx prisma db seed

# 5. Run
npm run dev                 # http://localhost:3000
```

Health check: `curl http://localhost:3000/api/health` → `{"status":"ok","db":"up",...}`

Inspect the DB anytime with `npx prisma studio`.

### Seeded accounts

All seeded users share the password **`password123`**.

| Email | Role | Notes |
|---|---|---|
| `admin@piecetogether.test` | ADMIN | Warehouse + dispute/payout admin panels |
| `alice@piecetogether.test` | MEMBER | Owner with popular listings, Pro plan |
| `bob@piecetogether.test` | MEMBER | Subscriber/borrower, Plus plan |
| `carol@piecetogether.test` | MEMBER | Bloat owner (many unpopular listings) |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (revenue math + state machine) |
| `npm run db:seed` | Seed the database (idempotent) |
| `npm run prisma:studio` | Browse the DB |

## Key concepts

- **Rental lifecycle** — a guarded state machine
  (`src/lib/services/rentalStateMachine.ts`):
  `REQUESTED → APPROVED → SHIPPED_TO_BORROWER → IN_HAND → RETURN_SHIPPED →
  RETURNED → COMPLETED` (with `DECLINED`/`CANCELED`/`DISPUTED` branches). Every
  transition validates the current status before mutating.
- **Duration-based pricing** — the borrower picks a period (1/2/4 weeks);
  `quotedFeeCents = ratePerWeekCents × weeks`, locked in at approval
  (`src/lib/services/pricing.ts`).
- **Blended revenue share** — owner payout is driven by an *Owner Standing*
  score blending **contribution** (capped, anti-bloat) with **demand**
  (favorites + completed rentals + ratings). Locked into a `RevenueShareEntry`
  at completion (`src/lib/services/revenueShare.ts`).
- **Refundable deposit + photo proof** — the borrower uploads a photo of the
  assembled puzzle before teardown; the return is gated on it. The lender
  inspects and either completes (deposit refunded) or disputes (partial/full
  forfeit).
- **Swappable services** — payments, shipping, and storage sit behind
  interfaces with `Simulated*` implementations selected by env var.

## Extensibility

All rental/deposit/shipping/revenue logic references `CatalogItem`/
`InventoryItem`, never "puzzle." A category is one small module in
`src/lib/categories/` (label, attribute schema, browse filters, condition-proof
prompt, survey fields). Adding board or card games = a new module + seed data,
not a migration. v1 registers only `JIGSAW_PUZZLE`.

## Configuration

Tunables live in `src/lib/config.ts`: rental periods, revenue-share weights
(α/β/γ/δ, `CONTRIB_CAP`), fee tiers, and the shipping policy (who pays each
leg — MVP default: borrower pays both directions, overridable via
`SHIPPING_*_PAID_BY` env vars).
