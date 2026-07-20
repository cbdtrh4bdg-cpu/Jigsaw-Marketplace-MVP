-- Make the schema self-sufficient for Supabase/PostgREST inserts.
--
-- Prisma generated ids (cuid), `reference`, and updated timestamps in
-- application code. Without Prisma, the database must supply them, so we add
-- DB-level defaults and an updatedAt trigger.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop the NextAuth *adapter* tables — we use the Credentials provider with a
-- JWT session strategy, which needs none of them.
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;

-- Default text primary keys to a generated uuid string.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User','CatalogItem','InventoryItem','SubscriptionPlan','Subscription',
    'Rental','Deposit','Shipment','ConditionProof','RentalExperience',
    'Dispute','RevenueShareEntry','SimulatedPayment','Favorite','Review'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text', t
    );
  END LOOP;
END $$;

-- SimulatedPayment.reference is a unique idempotency key.
ALTER TABLE "SimulatedPayment"
  ALTER COLUMN reference SET DEFAULT gen_random_uuid()::text;

-- updatedAt: default on insert + auto-maintain on update.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['User','CatalogItem','InventoryItem','Subscription'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "updatedAt" SET DEFAULT now()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['User','CatalogItem','InventoryItem','Subscription'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t
    );
  END LOOP;
END $$;
