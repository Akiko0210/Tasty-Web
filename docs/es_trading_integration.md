# ES Futures Integration Guide

## Critical Considerations for Trading Platform Developers

---

## 1. Contract Lifecycle Management

This is the single most important thing to get right. ES contracts are not perpetual — they expire and must be managed.

### Active Contract Tracking

- At any time, **5 quarterly contracts are listed simultaneously** (ESM6, ESU6, ESZ6, ESH7, ESM7…)
- Your system must always know which contract is the **front month** (highest volume/liquidity)
- The front month changes on expiration — do not hardcode contract symbols
- Build a **contract resolver** that dynamically determines the active front-month symbol based on the current date

### Roll Period

- Liquidity migrates from front-month to next-month roughly **8–10 days before expiration**
- Your platform must detect and handle this roll: auto-suggest or auto-roll positions if the user holds through it
- If a user holds an expiring position and your system doesn't handle rollover, they will be **cash-settled without warning**
- Display a **roll warning banner** starting ~10 days before expiration

### Expiration Dates

- Always the **3rd Friday of March, June, September, December**
- Settlement is **AM-settled** at 8:30 AM CT via the Special Opening Quotation (SOQ)
- The SOQ is based on the opening auction price of each S&P 500 component — it is NOT the same as the futures price at 8:30 AM
- Do not let users place new orders in an expiring contract on expiration morning — the market behaves abnormally

### Symbol Naming

- CME Globex format: `ES` + month code + single-digit year (e.g., `ESM6`)
- Month codes: H=Mar, M=Jun, U=Sep, Z=Dec
- Tastytrade uses single-digit year; other platforms may use two or four digits — normalize this in your data layer

---

## 2. Pricing and Tick Rules

Getting math wrong here means real money lost or gained incorrectly for users.

### Contract Specs

| Spec             | Value               |
| ---------------- | ------------------- |
| Multiplier       | $50 per point       |
| Tick size        | 0.25 points         |
| Tick value       | $12.50 per contract |
| Minimum P&L unit | $12.50              |

### Never Calculate P&L in Dollars Directly

Always calculate in **ticks** first, then multiply:

```
ticks = (exit_price - entry_price) / 0.25
P&L = ticks × $12.50 × num_contracts
```

A 1-point move = 4 ticks = $50 per contract. A 10-point move = $500 per contract. Sanity-check all P&L display against these numbers.

### Price Precision

- ES prices are always in **0.25 increments** — reject any order with a price not divisible by 0.25
- Display prices to 2 decimal places (e.g., 5432.75, not 5432.7 or 5432.755)
- Internally store prices as integers (ticks) to avoid floating-point errors

---

## 3. Margin and Buying Power

ES margin is **SPAN-based**, not the standard Reg-T equity margin. This is a completely different system.

### SPAN Margin

- Set by the CME, not the broker — it changes based on market volatility
- Current overnight margin per contract is typically ~$12,000–$15,000 but can spike dramatically during volatile periods
- Your system must **fetch live SPAN margin requirements** from your clearing partner — do not hardcode
- Margin requirements can change **intraday** during extreme volatility events

### Intraday vs. Overnight Margin

- Intraday margin (day trading only, non-IRA) is typically **25% of overnight** — providing 4x leverage
- If a user doesn't close by 4:00 PM CT, the position converts to overnight margin requirements
- Your system must monitor this transition and issue warnings or auto-liquidate if the account cannot meet overnight requirements

### Margin Calls

- If account equity drops below maintenance margin, issue a margin call immediately
- ES moves $50/point — a 20-point adverse move on one contract = $1,000 loss
- During flash crashes or gap opens, losses can exceed account equity instantly
- Implement **real-time margin monitoring**, not just end-of-day checks

---

## 4. Settlement and Expiration Mechanics

### Cash Settlement

- ES is **cash-settled** — there is no physical delivery, no stock transfer
- At expiration, open positions are settled against the SOQ and the P&L is credited/debited in cash
- The SOQ is published by the CME after the market opens on expiration Friday — it can differ significantly from the overnight futures price

### What Happens to Options on Expiring Futures

- Options on ESM6 that expire _before_ June 19 settle against the futures price at 3:00 PM CT (ESF fixing)
- The **quarterly option** (expiring same day as the futures) settles at 8:30 AM CT via SOQ
- These are two different settlement mechanisms — do not conflate them

### Post-Expiration Behavior

- After 8:30 AM CT on expiration Friday, ESM6 no longer trades
- ESU6 becomes the new front month
- Your order routing must automatically redirect new orders to the new front month
- Any GTC (Good Till Cancelled) orders resting in the expired contract must be cancelled

---

## 5. Trading Hours

ES trades nearly 24 hours a day but not continuously. Get this wrong and users will place orders into a closed market.

### Session Schedule (All times CT)

| Session                 | Open    | Close   |
| ----------------------- | ------- | ------- |
| Sunday open             | 5:00 PM | —       |
| Daily close             | —       | 4:00 PM |
| Daily maintenance break | 4:00 PM | 5:00 PM |
| Friday close            | 4:00 PM | —       |
| Weekend                 | Closed  | —       |

- Trading resumes **Sunday at 5:00 PM CT** for the new week
- The **1-hour maintenance break** (4:00–5:00 PM CT) is often missed by developers — orders cannot be placed or filled during this window
- Globex (electronic) session is the only session for ES — there is no pit/floor session

### Holiday Schedule

- CME publishes a holiday calendar — markets may close early or be fully closed
- Always fetch the CME holiday calendar programmatically; do not hardcode holidays
- Notable: US holidays can cause early closes (1:00 PM CT) or full closures

---

## 6. Order Types and Execution

### Supported Order Types for ES

- **Limit** — strongly recommended as default; avoids slippage on a $50/point contract
- **Market** — use with extreme caution; ES can have wide bid/ask spreads during off-hours
- **Stop** — for stop-loss; but be aware of gap risk (price can jump past stop level)
- **Stop-Limit** — preferred over plain stop orders to control execution price
- **GTC (Good Till Cancelled)** — must be cancelled on contract expiration

### Order Validation Rules to Enforce

- Price must be in 0.25 increments
- Quantity must be a whole number (no fractional contracts)
- Do not allow market orders during the maintenance break or outside trading hours
- Warn users placing market orders during low-liquidity hours (overnight, weekends)
- Maximum order size limits vary by broker — validate against account buying power before submission

### Fills and Partial Fills

- Large orders (10+ contracts) may receive partial fills
- Your system must handle partial fill states — a 10-contract order may come back as 3 filled, 7 pending
- Display partial fill status clearly; do not show a position as fully open until fully filled

---

## 7. Real-Time Data Requirements

### Data Feeds

- ES requires a **CME Globex data feed** — this is not free
- Options: CME DataMine, Rithmic, CQG, Interactive Brokers, Tradovate API
- You need: real-time quotes, time & sales, depth of market (order book), and contract metadata

### What to Stream Per Contract

- Bid / Ask / Last / Volume / Open Interest
- Daily High / Low / Settlement
- Implied volatility (for options chain, if applicable)
- VWAP (useful for institutional-style displays)

### Latency Considerations

- ES is one of the most actively traded instruments in the world — your feed must handle high-frequency updates
- Throttle UI updates to prevent rendering bottlenecks (don't re-render on every tick — batch at 100–250ms intervals)
- Store raw ticks in a ring buffer; display a smoothed view

---

## 8. Risk Management Controls

These protect both the user and your platform.

### Per-Account Controls

- Maximum position size per contract (e.g., no more than 50 contracts for a given account tier)
- Maximum daily loss limit — auto-liquidate if breached
- Maximum single-order size
- Margin utilization alert thresholds (e.g., warn at 80%, restrict at 95%)

### Per-Platform Controls

- Aggregate position limits across all users (regulatory requirement)
- Kill switch — ability to cancel all open orders and flatten all positions instantly
- Circuit breakers if unusual order flow is detected

### Gap Risk Warning

- ES can gap significantly on Sunday open after a weekend of news
- Warn users with open positions before the Sunday 5:00 PM CT open
- Stop orders do NOT guarantee execution at the stop price during a gap

---

## 9. Regulatory and Compliance

### NFA and CFTC

- ES is a regulated futures product — your platform must be connected to an **NFA-registered FCM** (Futures Commission Merchant)
- You cannot offer ES trading without either being registered or operating under a registered FCM's umbrella
- All trades must be reported; your clearing partner handles this but you must ensure proper account linkage

### Account Requirements

- Futures accounts require a separate agreement (not just a standard brokerage agreement)
- Users must acknowledge the **CFTC Risk Disclosure Statement** and **Futures & Exchange-Traded Options Risk Disclosure**
- IRA accounts trading futures have special minimums ($25,000 for standard ES, $5,000 for MES)

### Position Limits

- CME sets position limits: 300,000 ES-equivalent contracts net on the same side across all months
- This is unlikely to be hit by retail users but your system should be aware of it for institutional accounts

### Record Keeping

- You are required to maintain records of all orders, fills, and cancellations
- Time-stamp all records to the millisecond in UTC

---

## 10. MES (Micro E-mini) — Build for Both

If you're integrating ES, strongly consider **MES (/MES)** simultaneously. It is 1/10th the size of ES:

| Spec            | ES       | MES     |
| --------------- | -------- | ------- |
| Multiplier      | $50/pt   | $5/pt   |
| Tick value      | $12.50   | $1.25   |
| Margin (approx) | ~$13,000 | ~$1,300 |
| Symbol format   | ESM6     | MESM6   |

- Same expiration dates, same trading hours, same settlement mechanism
- MES is essential for smaller accounts and position sizing precision
- Most of your ES integration code can be reused with MES by parameterizing the multiplier and tick value
- Do not hardcode ES-specific values anywhere — abstract contract specs into a config object

---

## 11. Common Integration Mistakes

| Mistake                                           | Consequence                                              |
| ------------------------------------------------- | -------------------------------------------------------- |
| Hardcoding the front-month symbol                 | Orders routed to expired contract                        |
| Using floating-point for price/P&L math           | Rounding errors compound into incorrect account balances |
| Not handling the 4–5 PM CT maintenance break      | Orders silently fail or queue incorrectly                |
| Treating SOQ same as last traded price            | Incorrect settlement values shown to users               |
| Ignoring SPAN margin changes                      | Users under-margined without warning                     |
| Not cancelling GTC orders on expiration           | Stale orders persist in expired contract                 |
| Using Reg-T margin logic for futures              | Completely wrong buying power calculations               |
| Not differentiating intraday vs. overnight margin | Users surprised by margin calls at 4 PM CT               |
| Assuming Sunday open = Friday close price         | Gap risk blindsides users                                |
| Not validating 0.25 tick increments               | Orders rejected by exchange with no clear error message  |

---

## 12. Recommended Architecture Approach

```
┌─────────────────────────────────────────┐
│           CONTRACT REGISTRY             │
│  - Active contracts list               │
│  - Front-month resolver                │
│  - Expiration calendar (CME-sourced)   │
│  - Roll date calculator                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│           MARKET DATA LAYER             │
│  - CME Globex feed connection          │
│  - Tick normalizer (→ integer ticks)   │
│  - Throttled UI publisher (250ms)      │
│  - Historical OHLCV store              │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│           ORDER MANAGEMENT              │
│  - Pre-trade validation                │
│  - Tick-size enforcement               │
│  - Session hours gating               │
│  - Partial fill state machine          │
│  - GTC expiration cleanup             │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│           RISK ENGINE                   │
│  - Real-time SPAN margin monitor       │
│  - Intraday → overnight transition     │
│  - Daily loss limit enforcement        │
│  - Auto-liquidation trigger            │
│  - Roll warning system                 │
└─────────────────────────────────────────┘
```

---

## Quick Reference Checklist

- [ ] Contract resolver dynamically determines front-month from date
- [ ] Expiration calendar fetched from CME, not hardcoded
- [ ] Roll warning displayed 8–10 days before expiration
- [ ] All prices stored as integer ticks (not floats)
- [ ] P&L calculated as: ticks × $12.50 × contracts
- [ ] 0.25 tick increment enforced on all order entry
- [ ] Trading hours gating implemented including 4–5 PM CT break
- [ ] SPAN margin fetched live from clearing partner
- [ ] Intraday vs. overnight margin distinction implemented
- [ ] Real-time margin monitoring (not just end-of-day)
- [ ] GTC orders cancelled on contract expiration
- [ ] New orders auto-routed to new front-month post-expiration
- [ ] SOQ settlement handled separately from intraday settlement
- [ ] MES supported with parameterized contract specs
- [ ] Kill switch and daily loss limit implemented
- [ ] NFA/CFTC disclosures presented to users at account opening
- [ ] All order records timestamped in UTC to the millisecond

---

---

# tastytrade API Integration Guide

## ES Futures — Specific Implementation Reference

> **Base URLs**
>
> - Production: `https://api.tastytrade.com`
> - Sandbox (cert): `https://api.cert.tastyworks.com`
>
> All requests return JSON. All timestamps are ISO 8601 in UTC.
> Full reference: [developer.tastytrade.com](https://developer.tastytrade.com)

---

## TT-1. Authentication

tastytrade uses **session tokens** (short-lived) and **remember tokens** (long-lived). You must get a session token before every other API call.

### Login — `POST /sessions`

```bash
curl -X POST https://api.cert.tastyworks.com/sessions \
  -H 'Content-Type: application/json' \
  -d '{ "login": "your_username", "password": "your_password", "remember-me": true }'
```

**Response:**

```json
{
  "data": {
    "user": {
      "email": "user@example.com",
      "username": "your_username",
      "external-id": "U0000085345"
    },
    "session-token": "YkF_8uB6tiiGKF2hNRZ4QVs6gLr...",
    "remember-token": "j69DQ_4p75bzWGYPl_utuxfIbVy1au..."
  }
}
```

**Critical notes:**

- Pass `session-token` as the `Authorization` header on every subsequent request
- Session tokens expire — store the `remember-token` and use it to renew sessions without requiring the user to re-enter credentials
- For ES trading, the account must have **"The Works"** margin level enabled — check this during account setup, not at order time

---

## TT-2. Account Setup

### Fetch User Accounts — `GET /customers/me/accounts`

Always call this immediately after login to get the account number(s) for the session.

```bash
curl https://api.cert.tastyworks.com/customers/me/accounts \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**Key fields to check per account:**

```json
{
  "account": {
    "account-number": "5WT0001",
    "margin-or-cash": "Margin", // Must be "Margin" for ES futures
    "account-type-name": "Individual"
  },
  "authority-level": "owner" // "trade-only" or "read-only" restrict actions
}
```

**For ES futures specifically:**

- `margin-or-cash` must be `"Margin"` — cash accounts cannot trade futures
- Verify futures are enabled for the account via `GET /accounts/{account-number}/trading-status` before showing the ES interface
- Store the `account-number` — it is required on every balance, position, and order endpoint

---

## TT-3. Fetching ES Futures Instruments

### All Active Futures — `GET /instruments/futures`

Use this to dynamically resolve the front-month contract. Never hardcode `/ESM6`.

```bash
curl 'https://api.cert.tastyworks.com/instruments/futures?product-code=ES' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**Key response fields for each contract:**

```json
{
  "symbol": "/ESU3",
  "product-code": "ES",
  "contract-size": "50.0",
  "tick-size": "0.25",
  "notional-multiplier": "50.0",
  "last-trade-date": "2023-09-15",
  "expiration-date": "2023-09-15",
  "active": true,
  "active-month": true, // true = front month
  "next-active-month": false, // true = second month
  "is-closing-only": false, // true = DO NOT open new positions
  "stops-trading-at": "2023-09-15T13:30:00.000+00:00",
  "roll-target-symbol": "/ESZ3", // next contract to roll into
  "streamer-symbol": "/ESU23:XCME" // use this for DXLink market data
}
```

**Front-month resolver logic:**

```javascript
const contracts = response.data.items;
const frontMonth = contracts.find((c) => c["active-month"] === true);
const nextMonth = contracts.find((c) => c["next-active-month"] === true);
const rollTarget = frontMonth["roll-target-symbol"]; // pre-built for you
```

**`is-closing-only` is critical:** When this flips to `true`, block all new open orders immediately in your UI. Users can only close existing positions. This happens near expiration.

---

## TT-4. Fetching ES Options Chain

### Future Options Chain — `GET /instruments/future-option-chains/ES/nested`

Returns all ES options grouped by expiration, with strikes nested inside.

```bash
curl 'https://api.cert.tastyworks.com/instruments/future-option-chains/ES/nested' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**Response structure:**

```json
{
  "data": {
    "futures": [
      {
        "symbol": "/ESU3",
        "expiration-date": "2023-09-15",
        "active-month": true
      }
    ],
    "option-chains": [
      {
        "underlying-symbol": "/ES",
        "expirations": [
          {
            "underlying-symbol": "/ESU3", // which futures contract this settles into
            "expiration-date": "2023-07-17",
            "expiration-type": "Weekly", // or "Regular" for quarterly
            "settlement-type": "PM", // PM = 3pm CT fix; AM = SOQ at open
            "strikes": [
              {
                "strike-price": "5600.0",
                "call": "./ESU3 E3AN3 230717C5600", // use this as leg symbol
                "put": "./ESU3 E3AN3 230717P5600"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Key things to watch:**

- `settlement-type: "AM"` = quarterly option, settles at SOQ. `"PM"` = weekly/EOM, settles at 3pm CT ESF fix. Handle these differently in your settlement display
- `underlying-symbol` on each expiration tells you which futures contract it settles into — critical for understanding which contract the user actually gets exposure to
- The `call` and `put` symbol strings (e.g., `./ESU3 E3AN3 230717C5600`) are exactly what you pass in order legs — do not modify them

---

## TT-5. Account Balances and Futures Margin

### Account Balances — `GET /accounts/{account-number}/balances`

```bash
curl 'https://api.cert.tastyworks.com/accounts/5WT0001/balances' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**Futures-specific fields to monitor:**

```json
{
  "futures-margin-requirement": "13200.0", // current SPAN margin held
  "futures-overnight-margin-requirement": "13200.0", // overnight SPAN
  "futures-intraday-margin-requirement": "3300.0", // intraday SPAN (25% of overnight)
  "available-trading-funds": "4800.0", // funds available for new futures positions
  "maintenance-requirement": "13200.0",
  "maintenance-call-value": "0.0", // > 0 means margin call is active
  "net-liquidating-value": "18000.0"
}
```

**What to build from this:**

- `maintenance-call-value > 0` → trigger margin call UI immediately, block new orders
- `futures-margin-requirement / net-liquidating-value` = margin utilization percentage — show this as a live gauge
- `available-trading-funds` = how many more ES contracts the user can open — use this to cap order quantity in your UI
- Poll this endpoint every 30 seconds while the user has open futures positions; subscribe to the account streamer for real-time updates

### Live Margin Requirements — `GET /margin-requirements/{account-number}`

Use this for pre-trade margin checks before submitting an order:

```bash
curl 'https://api.cert.tastyworks.com/margin-requirements/5WT0001' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

---

## TT-6. Placing ES Futures Orders

Orders in the tastytrade API use a **legs** structure. Even a single outright futures trade is one leg.

### Submit Order — `POST /accounts/{account-number}/orders`

**Buy 1 /ESM6 (long one front-month contract):**

```json
{
  "time-in-force": "Day",
  "order-type": "Limit",
  "price": "5432.75",
  "price-effect": "Debit",
  "legs": [
    {
      "instrument-type": "Future",
      "symbol": "/ESM6",
      "quantity": 1,
      "action": "Buy to Open"
    }
  ]
}
```

**Close the position:**

```json
{
  "time-in-force": "Day",
  "order-type": "Limit",
  "price": "5445.00",
  "price-effect": "Credit",
  "legs": [
    {
      "instrument-type": "Future",
      "symbol": "/ESM6",
      "quantity": 1,
      "action": "Sell to Close"
    }
  ]
}
```

### Order Field Reference

| Field             | ES Futures Values                                              | Notes                                      |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `instrument-type` | `"Future"`                                                     | Not `"Equity"` — different field entirely  |
| `action`          | `Buy to Open`, `Sell to Open`, `Buy to Close`, `Sell to Close` | Must match existing position direction     |
| `order-type`      | `Limit`, `Market`, `Stop`, `Stop Limit`                        | Limit strongly recommended                 |
| `time-in-force`   | `Day`, `GTC`, `GTD`, `IOC`, `FOK`                              | GTC requires expiration date management    |
| `price-effect`    | `Debit` (buying), `Credit` (selling)                           | Required field — easy to get wrong         |
| `price`           | String, 0.25 increments                                        | `"5432.75"` not `5432.75` — send as string |

### Dry Run Before Submitting

Always call the dry run endpoint first to validate the order and get estimated fees:

```bash
POST /accounts/{account-number}/orders/dry-run
```

Same body as a real order. Returns buying power effect, estimated commissions, and any warnings — display these to the user before they confirm.

### Order Accepted Response

```json
{
  "data": {
    "order": {
      "id": 1234567,
      "status": "Received",
      "time-in-force": "Day",
      "order-type": "Limit",
      "price": "5432.75",
      "legs": [...],
      "cancellable": true,
      "editable": true
    },
    "buying-power-effect": {
      "change-in-margin-requirement": "13200.0",
      "change-in-buying-power": "-13200.0"
    },
    "fee-calculation": {
      "total-fees": "1.25",
      "total-fees-effect": "Debit"
    }
  }
}
```

**Store the order `id`** — you need it to cancel or replace the order.

---

## TT-7. Order Status and Flow

Orders pass through these states:

```
Received → Routed → Live → Filled
                  → Cancelled
                  → Rejected
```

| Status             | Meaning                           | Action                        |
| ------------------ | --------------------------------- | ----------------------------- |
| `Received`         | API accepted, not yet at exchange | Show spinner                  |
| `Routed`           | Sent to exchange                  | Show "pending"                |
| `Live`             | Resting at exchange               | Show live order in order book |
| `Filled`           | Fully executed                    | Update position               |
| `Partially Filled` | Some contracts filled             | Show split state              |
| `Cancelled`        | Cancelled by user or system       | Remove from open orders       |
| `Rejected`         | Exchange or risk rejection        | Show error with reason        |

### Cancel an Order — `DELETE /accounts/{account-number}/orders/{order-id}`

```bash
curl -X DELETE \
  'https://api.cert.tastyworks.com/accounts/5WT0001/orders/1234567' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

### Replace an Order — `PUT /accounts/{account-number}/orders/{order-id}`

Same body as a new order. Tastytrade atomically cancels the old order and submits the new one.

---

## TT-8. Streaming Market Data (DXLink)

Tastytrade uses **DXLink** (not a standard WebSocket REST feed) for real-time market data. This is a separate connection from the REST API.

### Step 1 — Get a Quote Token

```bash
GET /api-quote-tokens
Authorization: YOUR_SESSION_TOKEN
```

Returns a short-lived token specifically for the DXLink streamer.

### Step 2 — Connect to DXLink

```
wss://tasty-openapi-ws.dxfeed.com/realtime
```

Send the auth token, then subscribe to events using **streamer symbols** (not regular tastytrade symbols).

### DXLink Symbol Format for /ES

The streamer symbol is different from the order symbol:

| What           | Order Symbol               | DXLink Streamer Symbol |
| -------------- | -------------------------- | ---------------------- |
| Front-month ES | `/ESM6`                    | `/ESM26:XCME`          |
| Micro ES       | `/MESM6`                   | `/MESM26:XCME`         |
| ES option      | `./ESU3 E3AN3 230717C5600` | `./E3AN23C5600:XCME`   |

The streamer symbol is returned in the instruments API response as `streamer-symbol` — always use that value, never construct it manually.

### Event Types to Subscribe

| Event     | Data                                         | Use For                |
| --------- | -------------------------------------------- | ---------------------- |
| `Quote`   | `bidPrice`, `askPrice`, `bidSize`, `askSize` | Live spread display    |
| `Trade`   | `price`, `size`, `dayVolume`                 | Last price, volume     |
| `Greeks`  | `delta`, `gamma`, `theta`, `vega`, `iv`      | Options Greeks display |
| `Summary` | `dayHigh`, `dayLow`, `prevDayClose`          | OHLC bar               |
| `Candle`  | OHLCV for a given timeframe                  | Charts                 |

**Do NOT use `mark` or `mark-price` from the positions REST endpoint for P&L** — the tastytrade docs explicitly state these are deprecated. Use live `Trade.price` or `(Quote.bidPrice + Quote.askPrice) / 2` instead.

---

## TT-9. Streaming Account Data

Account updates (fills, order status changes, balance changes) come through a separate **WebSocket account streamer**.

### Connect

```
wss://streamer.tastytrade.com   (production)
wss://streamer.cert.tastyworks.com  (sandbox)
```

Authenticate with your session token immediately after connecting.

### Subscribe to Account Notifications

```json
{
  "action": "connect",
  "value": ["5WT0001"]
}
```

### Notification Types for ES Futures

| Type              | When Fired                                         | What to Do             |
| ----------------- | -------------------------------------------------- | ---------------------- |
| `Order`           | Order status changes (filled, cancelled, rejected) | Update order book UI   |
| `AccountBalance`  | Buying power or margin changes                     | Refresh margin display |
| `CurrentPosition` | Position quantity changes after fill               | Update positions tab   |
| `TradingStatus`   | Account-level restrictions change                  | Gate order submission  |

**Do not poll REST endpoints for order fills** — use the account streamer. Polling introduces latency and rate limit risk.

---

## TT-10. Fetching Positions

### Current Positions — `GET /accounts/{account-number}/positions`

```bash
curl 'https://api.cert.tastyworks.com/accounts/5WT0001/positions' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**For a futures position, key fields:**

```json
{
  "symbol": "/ESM6",
  "instrument-type": "Future",
  "quantity": "2",
  "quantity-direction": "Long", // or "Short"
  "average-open-price": "5432.75",
  "close-price": "5445.00", // previous day close — NOT live price
  "multiplier": 50, // always 50 for ES
  "cost-effect": "Debit",
  "realized-day-gain": "125.0",
  "realized-day-gain-effect": "Credit"
}
```

**P&L calculation from position data:**

```javascript
// DO NOT use close-price for live P&L — it's yesterday's close
// Use live bid/ask from DXLink instead
const livePrice = (quote.bidPrice + quote.askPrice) / 2;
const avgOpenPrice = parseFloat(position["average-open-price"]);
const multiplier = position.multiplier; // 50
const quantity = parseInt(position.quantity);
const direction = position["quantity-direction"] === "Long" ? 1 : -1;

const unrealizedPnL =
  (livePrice - avgOpenPrice) * multiplier * quantity * direction;
```

A quantity of `0` means the position is closed — tastytrade purges these overnight.

---

## TT-11. Transaction History

All fills and settlements are in the transactions endpoint.

### `GET /accounts/{account-number}/transactions`

Filter by instrument type for futures only:

```bash
curl 'https://api.cert.tastyworks.com/accounts/5WT0001/transactions?instrument-type=Future' \
  -H 'Authorization: YOUR_SESSION_TOKEN'
```

**Key fields for a futures trade:**

```json
{
  "transaction-type": "Trade",
  "transaction-sub-type": "Buy to Open",
  "symbol": "/ESM6",
  "instrument-type": "Future",
  "quantity": "1.0",
  "price": "5432.75",
  "value": "271637.50", // notional value (price × 50)
  "value-effect": "Debit",
  "commission": "1.25", // tastytrade commission
  "clearing-fees": "0.30", // exchange + NFA fees
  "net-value": "271639.05",
  "executed-at": "2026-05-16T14:23:11.549+00:00"
}
```

Results are paginated (250 per page) — implement pagination for full history.

---

## TT-12. Sandbox Environment

tastytrade provides a full **certification (sandbox) environment** at `https://api.cert.tastyworks.com`.

- Create a sandbox account at [developer.tastytrade.com](https://developer.tastytrade.com)
- The sandbox mirrors production but uses simulated data — no real money
- Order submissions work and return realistic responses
- **The sandbox does NOT stream real-time market data** — use static or mock prices for development
- Test all expiration and roll scenarios in sandbox before going to production

---

## TT-13. Common tastytrade API Mistakes for Futures

| Mistake                                                                            | What Happens                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| Using order symbol (`/ESM6`) instead of streamer symbol (`/ESM26:XCME`) for DXLink | No data received, silent failure                    |
| Sending `price` as a number instead of a string                                    | Order rejected                                      |
| Setting `price-effect` wrong (Debit/Credit reversed)                               | Order rejected or inverted                          |
| Using `action: "Buy to Open"` to close a long                                      | Rejected — use `"Sell to Close"`                    |
| Using `close-price` from positions for live P&L                                    | Shows yesterday's P&L, not today's                  |
| Polling REST for order fills instead of using account streamer                     | Delayed fills, rate limit hits                      |
| Not handling `is-closing-only: true` on contracts near expiration                  | Users can open new positions into expiring contract |
| Calling `GET /instruments/futures` once at startup                                 | Stale contract data after quarterly roll            |
| Not checking `maintenance-call-value` in balance response                          | Margin calls go undetected                          |
| Forgetting `dry-run` before order submission                                       | Users see unexpected fees and rejections            |

---

## TT-14. Rate Limits and Best Practices

- tastytrade does not publish exact rate limits but enforces them — aggressive polling will get you throttled
- Use the **account streamer** for real-time updates instead of polling REST
- Use the **DXLink streamer** for market data instead of polling quote endpoints
- Refresh instrument data (active contracts, options chain) once at session start and after each quarterly expiration — not on every request
- Cache session tokens in memory; refresh with the remember token before expiry
- All production API calls must go over HTTPS — no HTTP

---

## Updated Quick Reference Checklist (tastytrade-Specific)

- [ ] Sandbox account created at developer.tastytrade.com
- [ ] Session token auth implemented with remember-token refresh
- [ ] Account verified as Margin type with futures enabled before showing ES UI
- [ ] Front-month resolved dynamically from `GET /instruments/futures?product-code=ES`
- [ ] `active-month: true` used to identify front month, not hardcoded symbol
- [ ] `is-closing-only` flag checked before allowing new open orders
- [ ] `roll-target-symbol` used to pre-populate roll suggestions
- [ ] Orders use `instrument-type: "Future"` (not Equity)
- [ ] `price` sent as string in 0.25 increments
- [ ] `price-effect` correctly set (Debit to buy, Credit to sell)
- [ ] Dry-run called before every order submission
- [ ] Order `id` stored for cancel/replace operations
- [ ] DXLink connected using `streamer-symbol` from instruments response (not order symbol)
- [ ] Live P&L using DXLink Quote/Trade events, not `close-price` from positions
- [ ] Account streamer subscribed for fills and balance updates (not polling)
- [ ] `maintenance-call-value` monitored in balance response
- [ ] `futures-overnight-margin-requirement` vs `futures-intraday-margin-requirement` displayed distinctly
- [ ] Transaction history paginated correctly (250 per page)
- [ ] Instrument data refreshed after each quarterly expiration
