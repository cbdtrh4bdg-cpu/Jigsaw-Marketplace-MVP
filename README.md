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
| Database | **Supabase** (PostgreSQL) |
| Data access | **`@supabase/supabase-js`** (server-side, service role) |
| Atomic writes | **Postgres RPC functions** (plpgsql) for money/state ops |
| Auth | Auth.js (NextAuth) — Credentials + JWT sessions |
| UI | Tailwind CSS |
| Validation | Zod |
| Payments / Shipping / Storage | Stubbed provider interfaces (swap for Stripe/carrier/Supabase Storage) |
| Tests | Vitest (money + state-machine logic) |

### Why RPC functions?

`supabase-js` has **no client-side transactions**, but several operations must
be atomic — approving a rental holds the deposit, charges the fee (or applies a
credit), and reserves the copy in one shot; completing settles the deposit,
writes the payout ledger, and frees the copy together. Those live in plpgsql
functions (`supabase/migrations/0003_rpc_functions.sql`), each of which runs in
an implicit transaction. The TypeScript service layer does **authorization and
all business math** (pricing, credit application, the revenue-share split — all
unit-tested) and passes the computed amounts into the RPC, which performs the
guarded writes.

## Quick start

You need a PostgreSQL database. Either option works:

**Option A — hosted Supabase project (recommended)**

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations + seed. With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push          # applies supabase/migrations/*.sql
   psql "$DIRECT_DB_URL" -f supabase/seed.sql
   ```
   (or paste each file into the SQL editor, in order.)
3. Copy `.env.example` → `.env` and fill `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` from **Settings → API**.

**Option B — any local Postgres**

```bash
docker compose up -d db      # or a local Postgres 16
cp .env.example .env         # set DIRECT_DB_URL to your connection string
npm run db:reset             # applies supabase/migrations/*.sql then seeds
```
(supabase-js still needs a PostgREST endpoint to talk to at runtime — a hosted
project or a local `supabase start` stack. Option B is enough to run the SQL
migrations, the unit tests, and the RPC layer.)

Then:

```bash
npm install
npm run dev                  # http://localhost:3000
```

Health check: `curl http://localhost:3000/api/health` →
`{"status":"ok","db":"up","backend":"supabase",...}`

### Seeded accounts

All seeded users share the password **`password123`** (bcrypt-hashed in
`supabase/seed.sql` via pgcrypto, verified by bcryptjs at login).

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
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (revenue math + state machine) |
| `npm run db:reset` | Apply all `supabase/migrations/*.sql` then seed (needs `DIRECT_DB_URL`) |
| `npm run db:seed` | (Re-)run `supabase/seed.sql` |

## Database layout

```
supabase/
  migrations/
    0001_schema.sql            # tables (catalog, inventory, rentals, money, …)
    0002_supabase_defaults.sql # id/timestamp defaults, updatedAt trigger
    0003_rpc_functions.sql     # atomic money/state-machine RPCs (plpgsql)
  seed.sql                     # idempotent seed
  apply.sh                     # migrations + seed via psql (CLI-free)
```

## Key concepts

- **Rental lifecycle** — a guarded state machine
  (`src/lib/services/rentalStateMachine.ts`, unit-tested):
  `REQUESTED → APPROVED → SHIPPED_TO_BORROWER → IN_HAND → RETURN_SHIPPED →
  RETURNED → COMPLETED` (with `DECLINED`/`CANCELED`/`DISPUTED` branches). The TS
  service asserts each transition, then the RPC re-guards it with an optimistic
  `WHERE status = …` check.
- **Duration-based pricing** — the borrower picks a period (1/2/4 weeks);
  `quotedFeeCents = ratePerWeekCents × weeks`, locked in at approval
  (`src/lib/services/pricing.ts`).
- **Blended revenue share** — owner payout is driven by an *Owner Standing*
  score blending **contribution** (capped, anti-bloat) with **demand**
  (favorites + completed rentals + ratings), computed in TS and locked into a
  `RevenueShareEntry` at completion (`src/lib/services/revenueShare.ts`).
- **Refundable deposit + photo proof** — the borrower uploads a photo of the
  assembled puzzle before teardown; the return is gated on it (enforced both in
  the service and in the `return_ship` RPC). Photos are stored in **Supabase
  Storage** (`STORAGE_PROVIDER=supabase`, bucket `SUPABASE_STORAGE_BUCKET`,
  auto-created public on first upload); a local-disk `simulated` provider is
  available for offline dev.
- **Swappable services** — payments, shipping, and storage sit behind
  interfaces selected by env var (`Simulated*` impls, plus a Supabase Storage
  impl for uploads).

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

## Notes on security

All DB access is server-side using the Supabase **service role** key (which
bypasses row-level security); authorization is enforced in application code
(`src/lib/permissions.ts` + ownership checks in the rental service). A
production hardening pass would add RLS policies and a per-request
anon/authenticated client. Never expose the service role key to the browser.
