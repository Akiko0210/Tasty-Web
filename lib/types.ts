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
  status: string;
  daysToExpiry?: number;
}

export interface StrategyConfig {
  name: string;
  defaultLegs: Omit<Leg, "id" | "visible" | "status" | "daysToExpiry">[];
}

export interface Order {
  id: string;
  symbol: string;
  strategyName: string;
  status: string;
  legs: Leg[];
  createdAt: Date;
  totalCost: number;
  orderNumber: string;
  tif: string;
  profitLoss?: number;
}
