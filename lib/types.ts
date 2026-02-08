export type Side = "Short" | "Long";
export type OptionType = "Call" | "Put";

export type LegStatus =
  | "Working"
  | "Filled"
  | "Partially filled"
  | "Canceled"
  | "Rejected"
  | "Expired";

export interface Leg {
  id: string;
  strike: number;
  type: OptionType;
  expiration: string;
  side: Side;
  size: number;
  price: number;
  visible?: boolean;
  status: LegStatus;
}

export interface StrategyConfig {
  name: string;
  defaultLegs: Omit<Leg, "id" | "visible" | "status">[];
}

export interface Order {
  id: string;
  strategyName: string;
  legs: Leg[];
  createdAt: Date;
  totalCost: number;
  profitLoss?: number;
}
