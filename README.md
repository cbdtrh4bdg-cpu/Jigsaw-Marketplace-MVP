# PuzzleShare

A peer-to-peer **and** warehouse marketplace for renting jigsaw puzzles — with a
category-generic catalog designed to scale to board games and card games later.

Members subscribe for access, browse a shared community library, and borrow
puzzles for a chosen rental period. Owners who lend out desirable puzzles earn a
share of the rental fee. Payments, shipping, and image storage are simulated
behind swappable interfaces so real Stripe / carrier / S3 integrations can drop
in without touching call sites.

See [`docs`](./) and the implementation plan for the full design.

## Tech Stack

- **Next.js (App Router, TypeScript)** — UI + API route handlers in one app
- **PostgreSQL + Prisma** — relational data, migrations, seed script
- **Auth.js (NextAuth) Credentials** — email/password auth
- **Tailwind CSS** — styling
- **Zod** — shared validation
- **Vitest** — unit tests for money / state-machine logic

## Getting Started

### 1. Database

**Option A — Docker (portable, recommended on your own machine):**

```bash
docker compose up -d db
```

**Option B — local Postgres** (used in the hosted dev environment):

```bash
# start your local cluster, then:
createuser puzzle --createdb --pwprompt   # password: puzzle
createdb -O puzzle puzzle_marketplace
```

Either way the app connects via `DATABASE_URL` in `.env`
(default: `postgresql://puzzle:puzzle@localhost:5432/puzzle_marketplace`).

### 2. Install & set up

```bash
cp .env.example .env        # then edit if needed
npm install
npx prisma migrate dev      # apply migrations
npm run db:seed             # load demo data (added in Phase 1)
npm run dev                 # http://localhost:3000
```

### 3. Verify

```bash
curl http://localhost:3000/api/health
# => {"status":"ok","db":"connected"}
```

Inspect the database any time with `npm run db:studio` (Prisma Studio).

## Environment Variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Auth.js config |
| `PAYMENT_PROVIDER` | `simulated` (real Stripe later) |
| `SHIPPING_PROVIDER` | `simulated` (real carrier later) |
| `STORAGE_PROVIDER` | `simulated` (local uploads; S3 later) |
| `SHIPPING_POLICY` | `borrower_both` \| `subsidized` \| `split` |

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Run Vitest suite |
| `npm run db:migrate` | Create & apply a migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed |
