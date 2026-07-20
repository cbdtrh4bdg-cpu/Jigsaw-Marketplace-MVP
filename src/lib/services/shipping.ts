import { SIMULATED_SHIPPING_COST_CENTS } from "@/lib/config";
import type { ShipmentDirection } from "@/lib/db-types";

export interface RateQuote {
  costCents: number;
}

export interface Label {
  trackingCode: string;
  costCents: number;
}

export interface ShippingProvider {
  readonly name: string;
  quote(direction: ShipmentDirection): Promise<RateQuote>;
  buyLabel(direction: ShipmentDirection): Promise<Label>;
}

/** Deterministic fake costs + tracking; always succeeds. */
class SimulatedShippingProvider implements ShippingProvider {
  readonly name = "simulated";

  async quote(): Promise<RateQuote> {
    return { costCents: SIMULATED_SHIPPING_COST_CENTS };
  }

  async buyLabel(direction: ShipmentDirection): Promise<Label> {
    const trackingCode = `SIM-${direction}-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;
    return { trackingCode, costCents: SIMULATED_SHIPPING_COST_CENTS };
  }
}

let provider: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (provider) return provider;
  switch (process.env.SHIPPING_PROVIDER) {
    // case "easypost": provider = new EasyPostShippingProvider(); break;
    default:
      provider = new SimulatedShippingProvider();
  }
  return provider;
}
