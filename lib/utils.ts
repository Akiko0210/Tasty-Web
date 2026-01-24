import type { Leg } from "./types";

let legCounter = 0;

export function toLegs(config: Omit<Leg, "id" | "visible">[]): Leg[] {
  return config.map((l, i) => {
    legCounter++;
    return {
      ...l,
      id: `leg-${legCounter}-${i}`,
      visible: true,
    };
  });
}

export function calculateTotalCost(legs: Leg[]): number {
  return legs.reduce((total, leg) => {
    const cost = leg.price * leg.size * 100;
    return total + (leg.side === "Long" ? -cost : cost);
  }, 0);
}
