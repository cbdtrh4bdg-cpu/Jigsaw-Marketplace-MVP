import { RentalStatus } from "@/lib/db-types";

/**
 * The rental lifecycle graph. Pure & DB-free so illegal-transition guards are
 * unit tested cheaply.
 *
 * REQUESTED → APPROVED (or DECLINED/CANCELED)
 * APPROVED → SHIPPED_TO_BORROWER (or CANCELED)
 * SHIPPED_TO_BORROWER → IN_HAND
 * IN_HAND → RETURN_SHIPPED
 * RETURN_SHIPPED → RETURNED
 * RETURNED → COMPLETED (or DISPUTED)
 * DISPUTED → COMPLETED
 */
export const ALLOWED_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  [RentalStatus.REQUESTED]: [
    RentalStatus.APPROVED,
    RentalStatus.DECLINED,
    RentalStatus.CANCELED,
  ],
  [RentalStatus.APPROVED]: [
    RentalStatus.SHIPPED_TO_BORROWER,
    RentalStatus.CANCELED,
  ],
  [RentalStatus.SHIPPED_TO_BORROWER]: [RentalStatus.IN_HAND],
  [RentalStatus.IN_HAND]: [RentalStatus.RETURN_SHIPPED],
  [RentalStatus.RETURN_SHIPPED]: [RentalStatus.RETURNED],
  [RentalStatus.RETURNED]: [RentalStatus.COMPLETED, RentalStatus.DISPUTED],
  [RentalStatus.DISPUTED]: [RentalStatus.COMPLETED],
  // Terminal states
  [RentalStatus.DECLINED]: [],
  [RentalStatus.CANCELED]: [],
  [RentalStatus.COMPLETED]: [],
};

export function canTransition(from: RentalStatus, to: RentalStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export class IllegalTransitionError extends Error {
  constructor(
    public from: RentalStatus,
    public to: RentalStatus,
  ) {
    super(`Illegal rental transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(from: RentalStatus, to: RentalStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

export function isTerminal(status: RentalStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
