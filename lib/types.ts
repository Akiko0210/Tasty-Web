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

// ── Order placement ───────────────────────────────────────────────────────────

export interface OrderPayload {
  "time-in-force": "Day" | "GTC";
  "order-type": "Limit";
  price: string;
  "price-effect": "Debit" | "Credit";
  legs: {
    "instrument-type": string;
    symbol: string;
    quantity: number;
    action: string;
  }[];
}

export interface DryRunResult {
  order: { id: number; status: string; price: string; "price-effect": string };
  warnings: { message: string }[];
  "buying-power-effect": {
    "change-in-buying-power": string;
    "current-buying-power": string;
    "new-buying-power": string;
    impact: string;
    effect: string;
  };
  "fee-calculation": {
    commission: string;
    "regulatory-fees": string;
    "clearing-fees": string;
    "total-fees": string;
  };
}

export interface PlaceOrderResult {
  order: { id: number; status: string };
  warnings: { message: string }[];
}
