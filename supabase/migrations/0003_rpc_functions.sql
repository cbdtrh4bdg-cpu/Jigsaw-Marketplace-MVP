-- Atomic money / state-machine operations.
--
-- supabase-js has no client-side transactions, so every operation that must be
-- all-or-nothing (fee + deposit hold + reservation, settlement + payout, …)
-- lives in a plpgsql function — each runs in an implicit transaction.
--
-- Division of labour: the TypeScript service layer does authorization and all
-- business math (pricing, credit application, the revenue-share split — which
-- stay unit-tested). These functions receive the already-computed amounts and
-- perform the guarded writes. Each UPDATE guards on the expected status and
-- raises if it changed underneath us (optimistic concurrency).

-- APPROVE: lock fee, apply credits/charge, hold deposit, reserve copy.
CREATE OR REPLACE FUNCTION approve_rental(
  p_rental_id text,
  p_borrower_id text,
  p_quoted_fee int,
  p_credits_applied int,
  p_charge_cents int,
  p_deposit_cents int,
  p_due_at timestamptz
) RETURNS void AS $$
DECLARE
  v_inventory_id text;
BEGIN
  UPDATE "Rental"
     SET status = 'APPROVED', "approvedAt" = now(), "dueAt" = p_due_at,
         "quotedFeeCents" = p_quoted_fee, "creditsApplied" = p_credits_applied
   WHERE id = p_rental_id AND status = 'REQUESTED'
   RETURNING "inventoryItemId" INTO v_inventory_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental_not_in_expected_state';
  END IF;

  IF p_charge_cents > 0 THEN
    INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
    VALUES (p_borrower_id, p_rental_id, 'RENTAL_FEE', p_charge_cents, 'Rental fee');
  END IF;

  IF p_credits_applied > 0 THEN
    UPDATE "Subscription"
       SET "creditsRemaining" = "creditsRemaining" - p_credits_applied
     WHERE "userId" = p_borrower_id;
  END IF;

  INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
  VALUES (p_borrower_id, p_rental_id, 'DEPOSIT_HOLD', p_deposit_cents, 'Refundable deposit hold');

  INSERT INTO "Deposit"("rentalId","amountCents",status)
  VALUES (p_rental_id, p_deposit_cents, 'HELD');

  UPDATE "InventoryItem" SET status = 'RESERVED' WHERE id = v_inventory_id;
END;
$$ LANGUAGE plpgsql;

-- DECLINE.
CREATE OR REPLACE FUNCTION decline_rental(p_rental_id text) RETURNS void AS $$
BEGIN
  UPDATE "Rental" SET status = 'DECLINED'
   WHERE id = p_rental_id AND status = 'REQUESTED';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
END;
$$ LANGUAGE plpgsql;

-- CANCEL: refund any held deposit and release the reservation if approved.
CREATE OR REPLACE FUNCTION cancel_rental(p_rental_id text) RETURNS void AS $$
DECLARE
  v_prev_status text;
  v_inventory_id text;
  v_borrower_id text;
  v_dep "Deposit"%ROWTYPE;
BEGIN
  SELECT status, "inventoryItemId", "borrowerId"
    INTO v_prev_status, v_inventory_id, v_borrower_id
    FROM "Rental" WHERE id = p_rental_id FOR UPDATE;
  IF v_prev_status IS NULL OR v_prev_status NOT IN ('REQUESTED','APPROVED') THEN
    RAISE EXCEPTION 'rental_not_in_expected_state';
  END IF;

  UPDATE "Rental" SET status = 'CANCELED' WHERE id = p_rental_id;

  IF v_prev_status = 'APPROVED' THEN
    SELECT * INTO v_dep FROM "Deposit" WHERE "rentalId" = p_rental_id;
    IF FOUND AND v_dep.status = 'HELD' THEN
      INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
      VALUES (v_borrower_id, p_rental_id, 'DEPOSIT_REFUND', v_dep."amountCents", 'Deposit refunded (canceled)');
      UPDATE "Deposit" SET status = 'REFUNDED', "resolvedAt" = now()
       WHERE "rentalId" = p_rental_id;
    END IF;
    UPDATE "InventoryItem" SET status = 'AVAILABLE' WHERE id = v_inventory_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Shared shipping-leg writer.
CREATE OR REPLACE FUNCTION add_shipment_leg(
  p_rental_id text,
  p_direction text,
  p_cost int,
  p_tracking text,
  p_paid_by_role text,
  p_paid_by_user text
) RETURNS void AS $$
BEGIN
  INSERT INTO "Shipment"
    ("rentalId",direction,status,"costCents","paidByUserId","paidByRole","trackingCode")
  VALUES
    (p_rental_id, p_direction::"ShipmentDirection", 'IN_TRANSIT', p_cost,
     p_paid_by_user, p_paid_by_role::"PayerRole", p_tracking);

  INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
  VALUES (p_paid_by_user, p_rental_id, 'SHIPPING', p_cost,
          p_direction || ' shipping (paid by ' || p_paid_by_role || ')');
END;
$$ LANGUAGE plpgsql;

-- SHIP to borrower.
CREATE OR REPLACE FUNCTION ship_to_borrower(
  p_rental_id text, p_cost int, p_tracking text,
  p_paid_by_role text, p_paid_by_user text
) RETURNS void AS $$
BEGIN
  UPDATE "Rental" SET status = 'SHIPPED_TO_BORROWER', "shippedAt" = now()
   WHERE id = p_rental_id AND status = 'APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
  PERFORM add_shipment_leg(p_rental_id, 'OUTBOUND', p_cost, p_tracking, p_paid_by_role, p_paid_by_user);
END;
$$ LANGUAGE plpgsql;

-- RECEIVE by borrower.
CREATE OR REPLACE FUNCTION receive_by_borrower(p_rental_id text) RETURNS void AS $$
BEGIN
  UPDATE "Rental" SET status = 'IN_HAND', "receivedAt" = now()
   WHERE id = p_rental_id AND status = 'SHIPPED_TO_BORROWER';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
  UPDATE "Shipment" SET status = 'DELIVERED', "deliveredAt" = now()
   WHERE "rentalId" = p_rental_id AND direction = 'OUTBOUND';
END;
$$ LANGUAGE plpgsql;

-- RETURN SHIP: gated on the completion photo proof.
CREATE OR REPLACE FUNCTION return_ship(
  p_rental_id text, p_cost int, p_tracking text,
  p_paid_by_role text, p_paid_by_user text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ConditionProof" WHERE "rentalId" = p_rental_id) THEN
    RAISE EXCEPTION 'missing_condition_proof';
  END IF;
  UPDATE "Rental" SET status = 'RETURN_SHIPPED', "returnShippedAt" = now()
   WHERE id = p_rental_id AND status = 'IN_HAND';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
  PERFORM add_shipment_leg(p_rental_id, 'RETURN', p_cost, p_tracking, p_paid_by_role, p_paid_by_user);
END;
$$ LANGUAGE plpgsql;

-- MARK RETURNED by owner.
CREATE OR REPLACE FUNCTION mark_returned(p_rental_id text) RETURNS void AS $$
BEGIN
  UPDATE "Rental" SET status = 'RETURNED', "returnedAt" = now()
   WHERE id = p_rental_id AND status = 'RETURN_SHIPPED';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
  UPDATE "Shipment" SET status = 'DELIVERED', "deliveredAt" = now()
   WHERE "rentalId" = p_rental_id AND direction = 'RETURN';
END;
$$ LANGUAGE plpgsql;

-- OPEN DISPUTE.
CREATE OR REPLACE FUNCTION open_dispute(
  p_rental_id text, p_opened_by text, p_reason text
) RETURNS void AS $$
BEGIN
  UPDATE "Rental" SET status = 'DISPUTED'
   WHERE id = p_rental_id AND status = 'RETURNED';
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;
  INSERT INTO "Dispute"("rentalId","openedById",status,reason)
  VALUES (p_rental_id, p_opened_by, 'OPEN', p_reason);
END;
$$ LANGUAGE plpgsql;

-- COMPLETE (from RETURNED via inspect, or DISPUTED via resolve): settle the
-- deposit, write the revenue-share ledger row, pay the owner, free the copy.
CREATE OR REPLACE FUNCTION complete_rental(
  p_rental_id text,
  p_expected_status text,
  p_forfeit_cents int,
  p_owner_id text,
  p_fee int,
  p_owner_standing double precision,
  p_platform_bps int,
  p_bonus_bps int,
  p_owner_payout int,
  p_platform_cents int,
  p_resolution text
) RETURNS void AS $$
DECLARE
  v_inventory_id text;
  v_borrower_id text;
  v_dep "Deposit"%ROWTYPE;
  v_forfeit int;
  v_refund int;
  v_dep_status text;
BEGIN
  UPDATE "Rental" SET status = 'COMPLETED', "completedAt" = now()
   WHERE id = p_rental_id AND status = p_expected_status::"RentalStatus"
   RETURNING "inventoryItemId", "borrowerId" INTO v_inventory_id, v_borrower_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'rental_not_in_expected_state'; END IF;

  SELECT * INTO v_dep FROM "Deposit" WHERE "rentalId" = p_rental_id;
  IF FOUND AND v_dep.status = 'HELD' THEN
    v_forfeit := LEAST(p_forfeit_cents, v_dep."amountCents");
    v_refund := v_dep."amountCents" - v_forfeit;
    IF v_refund > 0 THEN
      INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
      VALUES (v_borrower_id, p_rental_id, 'DEPOSIT_REFUND', v_refund, 'Deposit refunded');
    END IF;
    IF v_forfeit > 0 THEN
      -- Forfeited money goes to the lender (P2P) or platform (owner null).
      INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
      VALUES (p_owner_id, p_rental_id, 'DEPOSIT_FORFEIT', v_forfeit, 'Deposit forfeited (damage/missing pieces)');
    END IF;
    IF v_forfeit = 0 THEN v_dep_status := 'REFUNDED';
    ELSIF v_forfeit >= v_dep."amountCents" THEN v_dep_status := 'FORFEITED';
    ELSE v_dep_status := 'PARTIALLY_FORFEITED';
    END IF;
    UPDATE "Deposit"
       SET status = v_dep_status::"DepositStatus", "forfeitedCents" = v_forfeit, "resolvedAt" = now()
     WHERE "rentalId" = p_rental_id;
  END IF;

  INSERT INTO "RevenueShareEntry"
    ("rentalId","ownerId","feeCents","ownerStanding","platformFeeBps",
     "popularityBonusBps","ownerPayoutCents","platformCents")
  VALUES
    (p_rental_id, p_owner_id, p_fee, p_owner_standing, p_platform_bps,
     p_bonus_bps, p_owner_payout, p_platform_cents);

  IF p_owner_id IS NOT NULL AND p_owner_payout > 0 THEN
    INSERT INTO "SimulatedPayment"("userId","rentalId",type,"amountCents",note)
    VALUES (p_owner_id, p_rental_id, 'PAYOUT', p_owner_payout, 'Owner payout');
  END IF;

  IF p_expected_status = 'DISPUTED' THEN
    UPDATE "Dispute"
       SET status = 'RESOLVED', resolution = p_resolution,
           "forfeitCents" = p_forfeit_cents, "resolvedAt" = now()
     WHERE "rentalId" = p_rental_id;
  END IF;

  UPDATE "InventoryItem" SET status = 'AVAILABLE' WHERE id = v_inventory_id;
END;
$$ LANGUAGE plpgsql;
