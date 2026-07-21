import type { ShipmentDirection } from "@prisma/client";
import { SIMULATED_SHIPPING_BASE_CENTS, shippingPolicy } from "@/lib/config";

export interface ShippingLabel {
  trackingNumber: string;
  costCents: number;
  labelUrlStub: string;
}

// The seam to any real carrier API. A real UPS/USPS impl drops in here.
export interface ShippingProvider {
  createLabel(direction: ShipmentDirection, weightHintPieces?: number): ShippingLabel;
}

class SimulatedShippingProvider implements ShippingProvider {
  createLabel(direction: ShipmentDirection, weightHintPieces = 500): ShippingLabel {
    // Deterministic fake cost: base + a little for larger/heavier puzzles.
    const surcharge = Math.round((weightHintPieces / 500) * 100);
    const trackingNumber = `SIM-${direction[0]}-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;
    return {
      trackingNumber,
      costCents: SIMULATED_SHIPPING_BASE_CENTS + surcharge,
      labelUrlStub: `/labels/${trackingNumber}.pdf`,
    };
  }
}

let provider: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (!provider) {
    switch (process.env.SHIPPING_PROVIDER) {
      case "simulated":
      default:
        provider = new SimulatedShippingProvider();
    }
  }
  return provider;
}

/**
 * Who pays a given leg, per the configured shipping policy.
 * Returns the user id to charge, or null when the platform absorbs it.
 * MVP default (borrower_both) has the borrower pay both directions.
 */
export function resolveShippingPayer(
  direction: ShipmentDirection,
  borrowerId: string,
  ownerId: string | null,
): string | null {
  switch (shippingPolicy) {
    case "split":
      // Borrower pays to receive; owner pays for the return.
      return direction === "OUTBOUND" ? borrowerId : ownerId;
    case "subsidized":
      // Platform absorbs shipping (no user charged).
      return null;
    case "borrower_both":
    default:
      return borrowerId;
  }
}
