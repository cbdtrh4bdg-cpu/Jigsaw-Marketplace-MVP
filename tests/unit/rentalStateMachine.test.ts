import { describe, expect, it } from "vitest";
import { RentalStatus } from "@prisma/client";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
} from "@/lib/services/rentalStateMachine";

describe("rental state machine", () => {
  it("allows the happy path end to end", () => {
    const path: RentalStatus[] = [
      RentalStatus.REQUESTED,
      RentalStatus.APPROVED,
      RentalStatus.SHIPPED_TO_BORROWER,
      RentalStatus.IN_HAND,
      RentalStatus.RETURN_SHIPPED,
      RentalStatus.RETURNED,
      RentalStatus.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("supports the dispute branch", () => {
    expect(canTransition(RentalStatus.RETURNED, RentalStatus.DISPUTED)).toBe(true);
    expect(canTransition(RentalStatus.DISPUTED, RentalStatus.COMPLETED)).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransition(RentalStatus.REQUESTED, RentalStatus.IN_HAND)).toBe(false);
    expect(canTransition(RentalStatus.APPROVED, RentalStatus.RETURNED)).toBe(false);
    expect(canTransition(RentalStatus.IN_HAND, RentalStatus.COMPLETED)).toBe(false);
  });

  it("rejects moving out of terminal states", () => {
    expect(isTerminal(RentalStatus.COMPLETED)).toBe(true);
    expect(isTerminal(RentalStatus.DECLINED)).toBe(true);
    expect(isTerminal(RentalStatus.CANCELED)).toBe(true);
    expect(canTransition(RentalStatus.COMPLETED, RentalStatus.APPROVED)).toBe(false);
    expect(canTransition(RentalStatus.DECLINED, RentalStatus.APPROVED)).toBe(false);
  });

  it("assertTransition throws IllegalTransitionError on bad moves", () => {
    expect(() =>
      assertTransition(RentalStatus.REQUESTED, RentalStatus.COMPLETED),
    ).toThrow(IllegalTransitionError);
  });

  it("every status has an explicit transition list", () => {
    for (const status of Object.values(RentalStatus)) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });
});
