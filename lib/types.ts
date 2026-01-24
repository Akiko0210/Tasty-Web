export type Side = "Short" | "Long";
export type OptionType = "Call" | "Put";

export interface Leg {
  id: string;
  strike: number;
  type: OptionType;
  expiration: string;
  side: Side;
  size: number;
  price: number;
  visible?: boolean;
}

export interface StrategyConfig {
  name: string;
  defaultLegs: Omit<Leg, "id" | "visible">[];
}

export type OrderStatus = "Live" | "Filled" | "Completed" | "Expired" | "In-Draft";

export interface Order {
  id: string;
  strategyName: string;
  legs: Leg[];
  status: OrderStatus;
  createdAt: Date;
  totalCost: number;
  profitLoss?: number;
}
