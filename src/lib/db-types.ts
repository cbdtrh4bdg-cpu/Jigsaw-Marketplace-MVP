/**
 * Local enum + row type definitions.
 *
 * These replace the types Prisma used to generate. Each enum follows the
 * value-and-type pattern (a `const` object plus a same-named union type) so
 * `Role.MEMBER` (value) and `Role` (type) both work, exactly as before.
 */

export const Role = { MEMBER: "MEMBER", ADMIN: "ADMIN" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Category = {
  JIGSAW_PUZZLE: "JIGSAW_PUZZLE",
  BOARD_GAME: "BOARD_GAME",
  CARD_GAME: "CARD_GAME",
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const InventorySource = { USER: "USER", WAREHOUSE: "WAREHOUSE" } as const;
export type InventorySource = (typeof InventorySource)[keyof typeof InventorySource];

export const InventoryStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  UNAVAILABLE: "UNAVAILABLE",
} as const;
export type InventoryStatus = (typeof InventoryStatus)[keyof typeof InventoryStatus];

export const RentalStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
  CANCELED: "CANCELED",
  SHIPPED_TO_BORROWER: "SHIPPED_TO_BORROWER",
  IN_HAND: "IN_HAND",
  RETURN_SHIPPED: "RETURN_SHIPPED",
  RETURNED: "RETURNED",
  DISPUTED: "DISPUTED",
  COMPLETED: "COMPLETED",
} as const;
export type RentalStatus = (typeof RentalStatus)[keyof typeof RentalStatus];

export const ShipmentDirection = { OUTBOUND: "OUTBOUND", RETURN: "RETURN" } as const;
export type ShipmentDirection =
  (typeof ShipmentDirection)[keyof typeof ShipmentDirection];

export const ShipmentStatus = {
  CREATED: "CREATED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
} as const;
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const PayerRole = {
  BORROWER: "BORROWER",
  LENDER: "LENDER",
  PLATFORM: "PLATFORM",
} as const;
export type PayerRole = (typeof PayerRole)[keyof typeof PayerRole];

export const DepositStatus = {
  HELD: "HELD",
  REFUNDED: "REFUNDED",
  PARTIALLY_FORFEITED: "PARTIALLY_FORFEITED",
  FORFEITED: "FORFEITED",
} as const;
export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus];

export const PaymentType = {
  SUBSCRIPTION: "SUBSCRIPTION",
  RENTAL_FEE: "RENTAL_FEE",
  DEPOSIT_HOLD: "DEPOSIT_HOLD",
  DEPOSIT_REFUND: "DEPOSIT_REFUND",
  SHIPPING: "SHIPPING",
  PAYOUT: "PAYOUT",
  DEPOSIT_FORFEIT: "DEPOSIT_FORFEIT",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentStatus = {
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const DisputeStatus = { OPEN: "OPEN", RESOLVED: "RESOLVED" } as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

// ---------------------------------------------------------------------------
// Row shapes (column names match the DB / PostgREST responses)
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: Role;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItemRow {
  id: string;
  category: Category;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  attributes: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemRow {
  id: string;
  catalogItemId: string;
  source: InventorySource;
  ownerId: string | null;
  status: InventoryStatus;
  condition: string | null;
  depositCents: number;
  ratePerWeekCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanRow {
  id: string;
  key: string;
  name: string;
  priceCents: number;
  monthlyCredits: number;
  active: boolean;
}

export interface SubscriptionRow {
  id: string;
  userId: string;
  planId: string;
  active: boolean;
  creditsRemaining: number;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalRow {
  id: string;
  inventoryItemId: string;
  borrowerId: string;
  status: RentalStatus;
  periodDays: number;
  quotedFeeCents: number;
  creditsApplied: number;
  requestedAt: string;
  approvedAt: string | null;
  dueAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  returnShippedAt: string | null;
  returnedAt: string | null;
  completedAt: string | null;
}

export interface DepositRow {
  id: string;
  rentalId: string;
  amountCents: number;
  status: DepositStatus;
  forfeitedCents: number;
  resolvedAt: string | null;
  note: string | null;
}

export interface ShipmentRow {
  id: string;
  rentalId: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  costCents: number;
  paidByUserId: string | null;
  paidByRole: PayerRole;
  trackingCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface ConditionProofRow {
  id: string;
  rentalId: string;
  imageUrl: string;
  note: string | null;
  uploadedAt: string;
}

export interface RentalExperienceRow {
  id: string;
  rentalId: string;
  timeToCompleteHours: number | null;
  difficultyRating: number | null;
  enjoymentRating: number | null;
  missingPiecesReported: number;
  notes: string | null;
  createdAt: string;
}

export interface DisputeRow {
  id: string;
  rentalId: string;
  openedById: string;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  forfeitCents: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RevenueShareEntryRow {
  id: string;
  rentalId: string;
  ownerId: string | null;
  feeCents: number;
  ownerStanding: number;
  platformFeeBps: number;
  popularityBonusBps: number;
  ownerPayoutCents: number;
  platformCents: number;
  createdAt: string;
}

export interface ReviewRow {
  id: string;
  userId: string;
  catalogItemId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface FavoriteRow {
  id: string;
  userId: string;
  catalogItemId: string;
  createdAt: string;
}
