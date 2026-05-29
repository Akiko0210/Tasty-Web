# Tastytrade Multi-Leg Pricing Logic

This document explains the specific calculation methodology used by the Tastytrade platform to determine Bid and Ask prices for multi-leg orders, especially when dealing with **crossed markets** (where Bid > Ask).

## 1. The Market Scenario

In this example, we are looking at a **Butterfly Spread** (Long 1x, Short 2x, Long 1x) with the following market data:

| Leg       | Bid        | Ask        | Qty | Action |
| :-------- | :--------- | :--------- | :-- | :----- |
| **Leg 1** | 118.90     | 120.20     | 1x  | Long   |
| **Leg 2** | **112.80** | **112.70** | 2x  | Short  |
| **Leg 3** | 109.20     | 110.60     | 1x  | Long   |

\*Note: Leg 2 is **crossed** by $0.10.

---

## 2. Calculating the ASK (5.20 Debit)

The **Ask** represents the "Natural" price to establish the position. To calculate the price you pay (Debit), the platform assumes you execute at the least favorable price for each individual leg based on liquidity.

- **Buy Leg 1** at the Ask: `+120.20`
- **Sell 2x Leg 2** at the Bid: `-(2 * 112.80) = -225.60`
- **Buy Leg 3** at the Ask: `+110.60`

**Formula:**
`120.20 - 225.60 + 110.60 = 5.20 Debit`

---

## 3. Calculating the BID (5.30 Credit)

The **Bid** represents the price to sell/close the position. In a standard market, this would be significantly lower than the Ask. However, when a leg is crossed, Tastytrade uses **Spread Optimization Logic**.

Instead of treating the butterfly as three independent legs, the platform calculates the price based on the two internal vertical spreads. This allows the platform to "capture" the inversion in Leg 2.

### Step A: Upper Vertical Spread (L1 & L2)

The logic pairs the Long Leg 1 with one of the Short Leg 2s. Because the market is crossed, it uses the **Ask price of Leg 2** to establish the narrowest possible spread for the calculation.

- `120.20 (L1 Ask) - 112.70 (L2 Ask) = 7.50 Debit`

### Step B: Lower Vertical Spread (L2 & L3)

The logic pairs the second Short Leg 2 with Long Leg 3. It uses the **Bid price of Leg 2** to maximize the credit for this component.

- `112.80 (L2 Bid) - 110.60 (L3 Ask) = 2.20 Credit`

### Step C: Net Strategy Result

To find the final Bid, the platform nets the two spreads:

- `7.50 (Debit) - 2.20 (Credit) = 5.30 Credit`

---

## 4. The "Inverted Quote" Principle

Following this logic, the strategy is quoted as:

- **Bid:** 5.30 CR
- **Ask:** 5.20 DB

This is known as an **Inverted Quote** (where the Bid is higher than the Ask).

### Why this happens:

The inversion in the strategy ($0.10 difference between $5.30 and $5.20) is a direct result of the $0.10 inversion in Leg 2. Tastytrade's logic ensures that the platform reflects the most efficient pairing of prices. In this scenario, if you could execute at the natural prices, you would receive more for selling the strategy ($5.30) than you would pay to buy it ($5.20).

---

## 5. Summary Rule for Multi-Leg Pricing

To replicate Tastytrade's calculation for any multi-leg order:

1.  **For the Ask:** Sum the cost of buying all long legs at their Asks and selling all short legs at their Bids.
2.  **For the Bid:** Decompose the trade into paired vertical spreads. Use the combination of Bids and Asks that minimizes the spread width (Optimized Pairing), capturing any inversions present in the individual legs.
