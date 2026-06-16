import { strategyConfigs } from "@/lib/constants";

// Tool definitions + system prompt for the LLM voice agent. Imported only by the
// server route (app/api/voice-agent/route.ts) — the browser executes the tools by
// name, so it never needs these schemas. Kept as plain JSON so the route can pass
// them straight to the Anthropic SDK.

const strategyNames = strategyConfigs.map((s) => s.name);

const noInput = { type: "object", properties: {}, additionalProperties: false } as const;

export const TOOL_DEFINITIONS = [
  {
    name: "get_ticket_state",
    description:
      "Read the current order ticket: symbol, strategy, legs, the live bid/mid/ask, the working limit price, time-in-force, and the underlying's current price. Use this to answer questions like 'what's the mid price', 'what's the bid and ask', 'what's the limit price', or 'read the order'.",
    input_schema: noInput,
  },
  {
    name: "build_strategy",
    description:
      "Build (or replace) the order ticket for a named options strategy. Pass ONLY the fields the user actually specified. `strikes` and `expiration` are BOTH optional: omit `strikes` to auto-pick strikes around the money, and omit `expiration` to use the nearest available expiration. For a butterfly, condor, calendar, or diagonal the user may say puts or calls — pass `optionType` then (named verticals already imply their type). After building, the tool returns a read-back of the resulting legs.",
    input_schema: {
      type: "object",
      properties: {
        strategyName: { type: "string", enum: strategyNames, description: "Which strategy to build." },
        optionType: {
          type: "string",
          enum: ["Call", "Put"],
          description: "Leg type, only for strategies that can be either (butterfly, condor, calendar, diagonal).",
        },
        strikes: {
          type: "array",
          items: { type: "number" },
          description: "Strike prices (any order). Snapped to the nearest tradable strikes. Omit to auto-select around the money.",
        },
        expiration: {
          type: "string",
          description: "Expiration as an ISO date YYYY-MM-DD. Snapped to the nearest available expiration. Omit for the nearest.",
        },
      },
      required: ["strategyName"],
      additionalProperties: false,
    },
  },
  {
    name: "set_limit_price",
    description: "Set the order's limit price (magnitude only; credit/debit is fixed by the mid).",
    input_schema: {
      type: "object",
      properties: { price: { type: "number", description: "The limit price, e.g. 2.50." } },
      required: ["price"],
      additionalProperties: false,
    },
  },
  {
    name: "set_tif",
    description: "Set the order's time-in-force.",
    input_schema: {
      type: "object",
      properties: { tif: { type: "string", enum: ["Day", "GTC"], description: "Day or GTC (good til cancelled)." } },
      required: ["tif"],
      additionalProperties: false,
    },
  },
  {
    name: "set_size",
    description: "Set the order quantity (number of lots). Leg ratios are preserved.",
    input_schema: {
      type: "object",
      properties: { size: { type: "integer", description: "Number of contracts/lots, at least 1." } },
      required: ["size"],
      additionalProperties: false,
    },
  },
  {
    name: "set_symbol",
    description: "Switch the ticket to a different underlying symbol (must be in the user's watchlist).",
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Ticker, e.g. SPX, AAPL, /ES." } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_underlying_price",
    description: "Get the current market price of an underlying symbol. Omit `symbol` to use the ticket's current symbol.",
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Ticker, e.g. SPX, AAPL, /ES. Optional." } },
      additionalProperties: false,
    },
  },
  {
    name: "submit_order",
    description:
      "Run a risk check (dry run) on the current ticket and open the confirmation modal. Returns a summary with net premium, buying-power effect, fees, and any warnings. This does NOT place the order — read the summary to the user, then call confirm_order only after they explicitly confirm.",
    input_schema: noInput,
  },
  {
    name: "confirm_order",
    description: "Place the order that submit_order prepared. Only call after the user has explicitly confirmed.",
    input_schema: noInput,
  },
  {
    name: "cancel_pending_order",
    description: "Dismiss the confirmation modal without placing the order.",
    input_schema: noInput,
  },
  {
    name: "list_orders",
    description: "List the user's recent orders (last 30 days), optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["Working", "Filled", "Cancelled", "Rejected", "Expired", "Received"],
          description: "Optional status filter.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "cancel_order",
    description:
      "Cancel a working order. Call first with confirmed:false to preview the order (it returns the order details so you can read them back). Only call again with confirmed:true after the user agrees. Omit orderNumber to target the most recent working order.",
    input_schema: {
      type: "object",
      properties: {
        orderNumber: { type: "string", description: "The order number to cancel. Omit for the most recent working order." },
        confirmed: { type: "boolean", description: "false to preview, true to actually cancel after user confirmation." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "filter_orders",
    description:
      "Navigate to the orders page AND apply a visual filter so the user sees the matching orders on screen. Use this when the user wants to SEE orders (e.g. 'show me my working orders', 'filter by SPX', 'show filled orders from last week'). For a spoken-only listing without navigating, use list_orders instead. Pass only the fields the user specified; omit the rest to leave those filters unchanged.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["All", "Working", "Filled", "Cancelled", "Rejected", "Expired", "Received"],
          description: "Status filter. Pass 'All' to clear the status filter.",
        },
        symbol: { type: "string", description: "Symbol to filter by (e.g. 'SPX'). Pass empty string to clear." },
        dateStart: { type: "string", description: "Start of date range, ISO YYYY-MM-DD." },
        dateEnd: { type: "string", description: "End of date range, ISO YYYY-MM-DD." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "navigate",
    description: "Move the user to a different page of the app.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string", enum: ["orders", "dashboard", "strategies"], description: "Destination page." } },
      required: ["to"],
      additionalProperties: false,
    },
  },
];

export function buildSystemPrompt(now: Date): string {
  const today = now.toISOString().slice(0, 10);
  return [
    "You are a voice trading assistant inside the user's options-trading web app.",
    "The user is blind and interacts entirely by voice, so every spoken reply must be brief and concrete — usually a single sentence. No markdown, no lists, no emoji.",
    `Today's date is ${today}.`,
    "The user already knows the app; do not explain the interface. Use the tools to act on the order ticket and to read prices and orders.",
    "",
    "Building strategy orders: call build_strategy with ONLY the fields the user specified. Strikes and expiration are both optional — leave them out when the user doesn't give them and the ticket fills sensible defaults (strikes around the money, the nearest expiration). Convert spoken dates (e.g. 'July 5', 'this Friday') to an ISO YYYY-MM-DD date relative to today. For a butterfly or condor of puts or calls, pass optionType. After building, briefly read back the legs the tool reports.",
    "",
    "Prices: for the active order's mid, bid/ask, or limit price, call get_ticket_state. For an underlying's price (SPX, Apple, /ES, etc.), call get_underlying_price.",
    "",
    "Placing an order is a mandatory two-step, confirmed flow: call submit_order first (it runs a risk check and returns net premium, buying-power effect, fees, and warnings — read those aloud), then call confirm_order ONLY after the user explicitly says to confirm. Never call confirm_order without having called submit_order.",
    "",
    "Showing orders on screen: when the user wants to SEE orders ('show me working orders', 'filter by SPX'), call filter_orders — it navigates to the orders page and updates the visible filters. When the user just wants a voice summary without navigating, call list_orders instead.",
    "",
    "Cancelling a working order: call cancel_order with confirmed:false first, read the order back to the user, and only call cancel_order with confirmed:true after they agree.",
    "",
    "State numbers plainly (say the digits). If a tool returns an error, tell the user plainly in one sentence. If a request is genuinely ambiguous, ask one short question instead of guessing.",
  ].join("\n");
}
