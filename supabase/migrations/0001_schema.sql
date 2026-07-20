--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Category" AS ENUM (
    'JIGSAW_PUZZLE',
    'BOARD_GAME',
    'CARD_GAME'
);


--
-- Name: DepositStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DepositStatus" AS ENUM (
    'HELD',
    'REFUNDED',
    'PARTIALLY_FORFEITED',
    'FORFEITED'
);


--
-- Name: DisputeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DisputeStatus" AS ENUM (
    'OPEN',
    'RESOLVED'
);


--
-- Name: InventorySource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventorySource" AS ENUM (
    'USER',
    'WAREHOUSE'
);


--
-- Name: InventoryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryStatus" AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'UNAVAILABLE'
);


--
-- Name: PayerRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PayerRole" AS ENUM (
    'BORROWER',
    'LENDER',
    'PLATFORM'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'SUCCEEDED',
    'FAILED',
    'REFUNDED'
);


--
-- Name: PaymentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentType" AS ENUM (
    'SUBSCRIPTION',
    'RENTAL_FEE',
    'DEPOSIT_HOLD',
    'DEPOSIT_REFUND',
    'SHIPPING',
    'PAYOUT',
    'DEPOSIT_FORFEIT'
);


--
-- Name: RentalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RentalStatus" AS ENUM (
    'REQUESTED',
    'APPROVED',
    'DECLINED',
    'CANCELED',
    'SHIPPED_TO_BORROWER',
    'IN_HAND',
    'RETURN_SHIPPED',
    'RETURNED',
    'DISPUTED',
    'COMPLETED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'MEMBER',
    'ADMIN'
);


--
-- Name: ShipmentDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShipmentDirection" AS ENUM (
    'OUTBOUND',
    'RETURN'
);


--
-- Name: ShipmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShipmentStatus" AS ENUM (
    'CREATED',
    'IN_TRANSIT',
    'DELIVERED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: CatalogItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CatalogItem" (
    id text NOT NULL,
    category public."Category" DEFAULT 'JIGSAW_PUZZLE'::public."Category" NOT NULL,
    title text NOT NULL,
    brand text,
    "imageUrl" text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ConditionProof; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConditionProof" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    "imageUrl" text NOT NULL,
    note text,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Deposit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deposit" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    "amountCents" integer NOT NULL,
    status public."DepositStatus" DEFAULT 'HELD'::public."DepositStatus" NOT NULL,
    "forfeitedCents" integer DEFAULT 0 NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    note text
);


--
-- Name: Dispute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Dispute" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    "openedById" text NOT NULL,
    status public."DisputeStatus" DEFAULT 'OPEN'::public."DisputeStatus" NOT NULL,
    reason text NOT NULL,
    resolution text,
    "forfeitCents" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone
);


--
-- Name: Favorite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Favorite" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "catalogItemId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InventoryItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryItem" (
    id text NOT NULL,
    "catalogItemId" text NOT NULL,
    source public."InventorySource" NOT NULL,
    "ownerId" text,
    status public."InventoryStatus" DEFAULT 'AVAILABLE'::public."InventoryStatus" NOT NULL,
    condition text,
    "depositCents" integer DEFAULT 2000 NOT NULL,
    "ratePerWeekCents" integer DEFAULT 500 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Rental; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Rental" (
    id text NOT NULL,
    "inventoryItemId" text NOT NULL,
    "borrowerId" text NOT NULL,
    status public."RentalStatus" DEFAULT 'REQUESTED'::public."RentalStatus" NOT NULL,
    "periodDays" integer NOT NULL,
    "quotedFeeCents" integer DEFAULT 0 NOT NULL,
    "creditsApplied" integer DEFAULT 0 NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "dueAt" timestamp(3) without time zone,
    "shippedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "returnShippedAt" timestamp(3) without time zone,
    "returnedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone
);


--
-- Name: RentalExperience; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RentalExperience" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    "timeToCompleteHours" double precision,
    "difficultyRating" integer,
    "enjoymentRating" integer,
    "missingPiecesReported" integer DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RevenueShareEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RevenueShareEntry" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    "ownerId" text,
    "feeCents" integer NOT NULL,
    "ownerStanding" double precision NOT NULL,
    "platformFeeBps" integer NOT NULL,
    "popularityBonusBps" integer DEFAULT 0 NOT NULL,
    "ownerPayoutCents" integer NOT NULL,
    "platformCents" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "catalogItemId" text NOT NULL,
    rating integer NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Shipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Shipment" (
    id text NOT NULL,
    "rentalId" text NOT NULL,
    direction public."ShipmentDirection" NOT NULL,
    status public."ShipmentStatus" DEFAULT 'CREATED'::public."ShipmentStatus" NOT NULL,
    "costCents" integer NOT NULL,
    "paidByUserId" text,
    "paidByRole" public."PayerRole" NOT NULL,
    "trackingCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp(3) without time zone
);


--
-- Name: SimulatedPayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SimulatedPayment" (
    id text NOT NULL,
    "userId" text,
    "rentalId" text,
    type public."PaymentType" NOT NULL,
    status public."PaymentStatus" DEFAULT 'SUCCEEDED'::public."PaymentStatus" NOT NULL,
    "amountCents" integer NOT NULL,
    provider text DEFAULT 'simulated'::text NOT NULL,
    reference text NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "planId" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "creditsRemaining" integer DEFAULT 0 NOT NULL,
    "currentPeriodEnd" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SubscriptionPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionPlan" (
    id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    "priceCents" integer NOT NULL,
    "monthlyCredits" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    "passwordHash" text,
    role public."Role" DEFAULT 'MEMBER'::public."Role" NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    image text,
    "addressLine1" text,
    "addressLine2" text,
    city text,
    state text,
    "postalCode" text,
    country text DEFAULT 'US'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: CatalogItem CatalogItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CatalogItem"
    ADD CONSTRAINT "CatalogItem_pkey" PRIMARY KEY (id);


--
-- Name: ConditionProof ConditionProof_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConditionProof"
    ADD CONSTRAINT "ConditionProof_pkey" PRIMARY KEY (id);


--
-- Name: Deposit Deposit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deposit"
    ADD CONSTRAINT "Deposit_pkey" PRIMARY KEY (id);


--
-- Name: Dispute Dispute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_pkey" PRIMARY KEY (id);


--
-- Name: Favorite Favorite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY (id);


--
-- Name: InventoryItem InventoryItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_pkey" PRIMARY KEY (id);


--
-- Name: RentalExperience RentalExperience_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RentalExperience"
    ADD CONSTRAINT "RentalExperience_pkey" PRIMARY KEY (id);


--
-- Name: Rental Rental_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rental"
    ADD CONSTRAINT "Rental_pkey" PRIMARY KEY (id);


--
-- Name: RevenueShareEntry RevenueShareEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevenueShareEntry"
    ADD CONSTRAINT "RevenueShareEntry_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Shipment Shipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shipment"
    ADD CONSTRAINT "Shipment_pkey" PRIMARY KEY (id);


--
-- Name: SimulatedPayment SimulatedPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulatedPayment"
    ADD CONSTRAINT "SimulatedPayment_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPlan SubscriptionPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: CatalogItem_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CatalogItem_category_idx" ON public."CatalogItem" USING btree (category);


--
-- Name: CatalogItem_category_title_brand_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CatalogItem_category_title_brand_key" ON public."CatalogItem" USING btree (category, title, brand);


--
-- Name: ConditionProof_rentalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ConditionProof_rentalId_key" ON public."ConditionProof" USING btree ("rentalId");


--
-- Name: Deposit_rentalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Deposit_rentalId_key" ON public."Deposit" USING btree ("rentalId");


--
-- Name: Dispute_rentalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Dispute_rentalId_key" ON public."Dispute" USING btree ("rentalId");


--
-- Name: Favorite_catalogItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Favorite_catalogItemId_idx" ON public."Favorite" USING btree ("catalogItemId");


--
-- Name: Favorite_userId_catalogItemId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Favorite_userId_catalogItemId_key" ON public."Favorite" USING btree ("userId", "catalogItemId");


--
-- Name: InventoryItem_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_ownerId_idx" ON public."InventoryItem" USING btree ("ownerId");


--
-- Name: InventoryItem_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_status_idx" ON public."InventoryItem" USING btree (status);


--
-- Name: RentalExperience_rentalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RentalExperience_rentalId_key" ON public."RentalExperience" USING btree ("rentalId");


--
-- Name: Rental_borrowerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Rental_borrowerId_idx" ON public."Rental" USING btree ("borrowerId");


--
-- Name: Rental_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Rental_status_idx" ON public."Rental" USING btree (status);


--
-- Name: RevenueShareEntry_rentalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RevenueShareEntry_rentalId_key" ON public."RevenueShareEntry" USING btree ("rentalId");


--
-- Name: Review_catalogItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_catalogItemId_idx" ON public."Review" USING btree ("catalogItemId");


--
-- Name: Review_userId_catalogItemId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Review_userId_catalogItemId_key" ON public."Review" USING btree ("userId", "catalogItemId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Shipment_rentalId_direction_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Shipment_rentalId_direction_key" ON public."Shipment" USING btree ("rentalId", direction);


--
-- Name: SimulatedPayment_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SimulatedPayment_reference_key" ON public."SimulatedPayment" USING btree (reference);


--
-- Name: SimulatedPayment_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SimulatedPayment_type_idx" ON public."SimulatedPayment" USING btree (type);


--
-- Name: SubscriptionPlan_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON public."SubscriptionPlan" USING btree (key);


--
-- Name: Subscription_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_userId_key" ON public."Subscription" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ConditionProof ConditionProof_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConditionProof"
    ADD CONSTRAINT "ConditionProof_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deposit Deposit_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deposit"
    ADD CONSTRAINT "Deposit_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Dispute Dispute_openedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Dispute Dispute_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_catalogItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES public."CatalogItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InventoryItem InventoryItem_catalogItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES public."CatalogItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InventoryItem InventoryItem_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RentalExperience RentalExperience_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RentalExperience"
    ADD CONSTRAINT "RentalExperience_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rental Rental_borrowerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rental"
    ADD CONSTRAINT "Rental_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Rental Rental_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rental"
    ADD CONSTRAINT "Rental_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public."InventoryItem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RevenueShareEntry RevenueShareEntry_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevenueShareEntry"
    ADD CONSTRAINT "RevenueShareEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RevenueShareEntry RevenueShareEntry_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevenueShareEntry"
    ADD CONSTRAINT "RevenueShareEntry_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_catalogItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES public."CatalogItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Shipment Shipment_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shipment"
    ADD CONSTRAINT "Shipment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SimulatedPayment SimulatedPayment_rentalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulatedPayment"
    ADD CONSTRAINT "SimulatedPayment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES public."Rental"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SimulatedPayment SimulatedPayment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SimulatedPayment"
    ADD CONSTRAINT "SimulatedPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."SubscriptionPlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


