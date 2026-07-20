-- Idempotent seed. Safe to run repeatedly.
-- Passwords are hashed with pgcrypto's bcrypt (crypt/gen_salt('bf')), which is
-- verified at login by bcryptjs.compare. All seeded users share: password123

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- Users -----------------------------------------------------------------
INSERT INTO "User" (email, name, "passwordHash", role, "addressLine1", city, state, "postalCode")
VALUES
  ('admin@piecetogether.test', 'Admin', crypt('password123', gen_salt('bf')), 'ADMIN', NULL, NULL, NULL, NULL),
  ('alice@piecetogether.test', 'Alice', crypt('password123', gen_salt('bf')), 'MEMBER', '1 Puzzle Way', 'Portland', 'OR', '97201'),
  ('bob@piecetogether.test',   'Bob',   crypt('password123', gen_salt('bf')), 'MEMBER', '42 Borrow St', 'Seattle', 'WA', '98101'),
  ('carol@piecetogether.test', 'Carol', crypt('password123', gen_salt('bf')), 'MEMBER', NULL, NULL, NULL, NULL)
ON CONFLICT (email) DO NOTHING;

-- --- Plans -----------------------------------------------------------------
INSERT INTO "SubscriptionPlan" (key, name, "priceCents", "monthlyCredits")
VALUES
  ('starter', 'Starter', 0, 0),
  ('plus', 'Plus', 999, 1),
  ('pro', 'Pro', 1999, 3)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name, "priceCents" = EXCLUDED."priceCents",
      "monthlyCredits" = EXCLUDED."monthlyCredits";

-- --- Subscriptions ---------------------------------------------------------
INSERT INTO "Subscription" ("userId", "planId", active, "creditsRemaining", "currentPeriodEnd")
SELECT u.id, p.id, true, c.credits, now() + interval '1 month'
FROM (VALUES
  ('alice@piecetogether.test', 'pro', 3),
  ('bob@piecetogether.test', 'plus', 1),
  ('carol@piecetogether.test', 'starter', 0)
) AS c(email, plan_key, credits)
JOIN "User" u ON u.email = c.email
JOIN "SubscriptionPlan" p ON p.key = c.plan_key
ON CONFLICT ("userId") DO NOTHING;

-- --- Catalog + inventory ---------------------------------------------------
-- Helper: upsert a catalog title, then ensure one inventory copy for an owner.
DO $$
DECLARE
  v_cat text;
  v_owner text;
  r record;
  i int;
BEGIN
  -- Alice's desirable titles.
  FOR r IN SELECT * FROM (VALUES
    ('Starry Night', 'Ravensburger', 1000, 'medium', 600, 2000),
    ('Antique World Map', 'Buffalo Games', 2000, 'hard', 800, 3000)
  ) AS t(title, brand, pieces, diff, rate, deposit) LOOP
    INSERT INTO "CatalogItem" (category, title, brand, attributes)
    VALUES ('JIGSAW_PUZZLE', r.title, r.brand,
            jsonb_build_object('pieceCount', r.pieces, 'difficulty', r.diff))
    ON CONFLICT (category, title, brand) DO NOTHING;

    SELECT id INTO v_cat FROM "CatalogItem"
     WHERE category='JIGSAW_PUZZLE' AND title=r.title AND brand=r.brand;
    SELECT id INTO v_owner FROM "User" WHERE email='alice@piecetogether.test';

    IF NOT EXISTS (SELECT 1 FROM "InventoryItem" WHERE "catalogItemId"=v_cat AND "ownerId"=v_owner) THEN
      INSERT INTO "InventoryItem" ("catalogItemId", source, "ownerId", status, "ratePerWeekCents", "depositCents")
      VALUES (v_cat, 'USER', v_owner, 'AVAILABLE', r.rate, r.deposit);
    END IF;
  END LOOP;

  -- Carol's bloat: 12 unpopular listings.
  SELECT id INTO v_owner FROM "User" WHERE email='carol@piecetogether.test';
  FOR i IN 1..12 LOOP
    INSERT INTO "CatalogItem" (category, title, brand, attributes)
    VALUES ('JIGSAW_PUZZLE', 'Generic Landscape #' || i, 'NoName',
            jsonb_build_object('pieceCount', 500, 'difficulty', 'easy'))
    ON CONFLICT (category, title, brand) DO NOTHING;
    SELECT id INTO v_cat FROM "CatalogItem"
     WHERE category='JIGSAW_PUZZLE' AND title='Generic Landscape #' || i AND brand='NoName';
    IF NOT EXISTS (SELECT 1 FROM "InventoryItem" WHERE "catalogItemId"=v_cat AND "ownerId"=v_owner) THEN
      INSERT INTO "InventoryItem" ("catalogItemId", source, "ownerId", status, "ratePerWeekCents", "depositCents")
      VALUES (v_cat, 'USER', v_owner, 'AVAILABLE', 300, 1500);
    END IF;
  END LOOP;

  -- Warehouse copy (no owner).
  INSERT INTO "CatalogItem" (category, title, brand, attributes)
  VALUES ('JIGSAW_PUZZLE', 'Galaxy Spiral', 'Piece Together',
          jsonb_build_object('pieceCount', 1500, 'difficulty', 'medium'))
  ON CONFLICT (category, title, brand) DO NOTHING;
  SELECT id INTO v_cat FROM "CatalogItem"
   WHERE category='JIGSAW_PUZZLE' AND title='Galaxy Spiral' AND brand='Piece Together';
  IF NOT EXISTS (SELECT 1 FROM "InventoryItem" WHERE "catalogItemId"=v_cat AND source='WAREHOUSE') THEN
    INSERT INTO "InventoryItem" ("catalogItemId", source, "ownerId", status, "ratePerWeekCents", "depositCents")
    VALUES (v_cat, 'WAREHOUSE', NULL, 'AVAILABLE', 700, 2500);
  END IF;
END $$;

-- --- Demand signals: favorites, reviews ------------------------------------
INSERT INTO "Favorite" ("userId", "catalogItemId")
SELECT u.id, c.id FROM (VALUES
  ('bob@piecetogether.test', 'Starry Night', 'Ravensburger'),
  ('bob@piecetogether.test', 'Antique World Map', 'Buffalo Games'),
  ('carol@piecetogether.test', 'Starry Night', 'Ravensburger')
) AS f(email, title, brand)
JOIN "User" u ON u.email = f.email
JOIN "CatalogItem" c ON c.title = f.title AND c.brand = f.brand
ON CONFLICT ("userId", "catalogItemId") DO NOTHING;

INSERT INTO "Review" ("userId", "catalogItemId", rating, comment)
SELECT u.id, c.id, rv.rating, rv.comment FROM (VALUES
  ('bob@piecetogether.test', 'Starry Night', 'Ravensburger', 5, 'Gorgeous, great fit.'),
  ('carol@piecetogether.test', 'Starry Night', 'Ravensburger', 5, 'Loved it.'),
  ('bob@piecetogether.test', 'Antique World Map', 'Buffalo Games', 4, 'Tough but fun.')
) AS rv(email, title, brand, rating, comment)
JOIN "User" u ON u.email = rv.email
JOIN "CatalogItem" c ON c.title = rv.title AND c.brand = rv.brand
ON CONFLICT ("userId", "catalogItemId") DO NOTHING;

-- --- Historical completed rentals (data-only) for popularity ---------------
-- Give Alice's titles a rental history: Starry Night x8, World Map x4.
DO $$
DECLARE
  v_bob text;
  v_inv text;
  n int;
  want int;
BEGIN
  SELECT id INTO v_bob FROM "User" WHERE email='bob@piecetogether.test';
  FOR v_inv, want IN
    SELECT ii.id, w.want FROM (VALUES
      ('Starry Night', 'Ravensburger', 8),
      ('Antique World Map', 'Buffalo Games', 4)
    ) AS w(title, brand, want)
    JOIN "CatalogItem" c ON c.title=w.title AND c.brand=w.brand
    JOIN "InventoryItem" ii ON ii."catalogItemId"=c.id
  LOOP
    SELECT count(*) INTO n FROM "Rental"
     WHERE "inventoryItemId"=v_inv AND status='COMPLETED';
    WHILE n < want LOOP
      INSERT INTO "Rental" ("inventoryItemId", "borrowerId", status, "periodDays",
                            "quotedFeeCents", "approvedAt", "dueAt", "completedAt")
      VALUES (v_inv, v_bob, 'COMPLETED', 14, 1200, now(), now(), now());
      n := n + 1;
    END LOOP;
  END LOOP;
END $$;
