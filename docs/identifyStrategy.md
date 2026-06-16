# Options Trading Strategies

---

## Single Leg Strategies

### Long Call

- **Action:** Buy a Call
- **Strike:** Any (typically ATM or OTM)
- **Expiry:** Single leg, one expiration
- **Outlook:** Bullish
- **Max Profit:** Unlimited
- **Max Loss:** Premium paid

---

### Long Put

- **Action:** Buy a Put
- **Strike:** Any (typically ATM or OTM)
- **Expiry:** Single leg, one expiration
- **Outlook:** Bearish
- **Max Profit:** Strike price minus premium (stock → $0)
- **Max Loss:** Premium paid

---

### Short Call

- **Action:** Sell a Call
- **Strike:** OTM typically
- **Expiry:** Single leg, one expiration
- **Outlook:** Bearish / Neutral
- **Max Profit:** Premium received
- **Max Loss:** Unlimited

---

### Short Put

- **Action:** Sell a Put
- **Strike:** OTM typically
- **Expiry:** Single leg, one expiration
- **Outlook:** Bullish / Neutral
- **Max Profit:** Premium received
- **Max Loss:** Strike price minus premium

---

## Two-Leg Strategies (Same Expiry)

### Bull Call Spread

- **Leg 1:** Buy Call @ lower strike
- **Leg 2:** Sell Call @ higher strike
- **Expiry:** Same for both legs
- **Outlook:** Moderately Bullish
- **Max Profit:** Difference in strikes minus net debit
- **Max Loss:** Net debit paid

---

### Bear Put Spread

- **Leg 1:** Buy Put @ higher strike
- **Leg 2:** Sell Put @ lower strike
- **Expiry:** Same for both legs
- **Outlook:** Moderately Bearish
- **Max Profit:** Difference in strikes minus net debit
- **Max Loss:** Net debit paid

---

### Bull Put Spread

- **Leg 1:** Sell Put @ higher strike
- **Leg 2:** Buy Put @ lower strike
- **Expiry:** Same for both legs
- **Outlook:** Moderately Bullish
- **Max Profit:** Net credit received
- **Max Loss:** Difference in strikes minus net credit

---

### Bear Call Spread

- **Leg 1:** Sell Call @ lower strike
- **Leg 2:** Buy Call @ higher strike
- **Expiry:** Same for both legs
- **Outlook:** Moderately Bearish
- **Max Profit:** Net credit received
- **Max Loss:** Difference in strikes minus net credit

---

### Long Straddle

- **Leg 1:** Buy Call @ ATM strike
- **Leg 2:** Buy Put @ ATM strike (same strike)
- **Expiry:** Same for both legs
- **Outlook:** High volatility expected (direction unknown)
- **Max Profit:** Unlimited
- **Max Loss:** Total premium paid

---

### Short Straddle

- **Leg 1:** Sell Call @ ATM strike
- **Leg 2:** Sell Put @ ATM strike (same strike)
- **Expiry:** Same for both legs
- **Outlook:** Low volatility / Neutral
- **Max Profit:** Total premium received
- **Max Loss:** Unlimited

---

### Long Strangle

- **Leg 1:** Buy Call @ OTM strike (higher)
- **Leg 2:** Buy Put @ OTM strike (lower)
- **Expiry:** Same for both legs
- **Outlook:** High volatility expected (direction unknown)
- **Max Profit:** Unlimited
- **Max Loss:** Total premium paid

---

### Short Strangle

- **Leg 1:** Sell Call @ OTM strike (higher)
- **Leg 2:** Sell Put @ OTM strike (lower)
- **Expiry:** Same for both legs
- **Outlook:** Low volatility / Range-bound
- **Max Profit:** Total premium received
- **Max Loss:** Unlimited

---

## Two-Leg Strategies (Different Expiry)

### Calendar Spread

- **Leg 1:** Sell near-term option @ strike
- **Leg 2:** Buy far-term option @ same strike
- **Type:** Same type (both Calls or both Puts)
- **Outlook:** Neutral near-term, directional longer-term
- **Max Profit:** When stock pins at strike near expiry
- **Max Loss:** Net debit paid

---

### Diagonal Spread

- **Leg 1:** Sell near-term option @ one strike
- **Leg 2:** Buy far-term option @ different strike
- **Type:** Same type (both Calls or both Puts)
- **Outlook:** Directional with income generation
- **Max Profit:** Limited (varies by strikes)
- **Max Loss:** Net debit paid

---

## Four-Leg Strategies

### Iron Condor

- **Leg 1:** Buy OTM Put @ strike A (lowest)
- **Leg 2:** Sell OTM Put @ strike B
- **Leg 3:** Sell OTM Call @ strike C
- **Leg 4:** Buy OTM Call @ strike D (highest)
- **Strike order:** A < B < C < D (equidistant wings typical)
- **Expiry:** All same
- **Outlook:** Neutral / Range-bound
- **Max Profit:** Net credit received (stock stays between B and C)
- **Max Loss:** Width of widest spread minus net credit

---

### Iron Butterfly

- **Leg 1:** Buy OTM Put @ lower strike A
- **Leg 2:** Sell ATM Put @ middle strike B
- **Leg 3:** Sell ATM Call @ middle strike B (same as Leg 2)
- **Leg 4:** Buy OTM Call @ higher strike C
- **Strike order:** A < B < C (equidistant)
- **Expiry:** All same
- **Outlook:** Neutral — expects stock to pin at ATM (B)
- **Max Profit:** Net credit received (at expiry, stock = B)
- **Max Loss:** Width of spread minus net credit

---

### Long Butterfly

- **Leg 1:** Buy 1 Call (or Put) @ low strike A
- **Leg 2:** Sell 2 Calls (or Puts) @ middle strike B
- **Leg 3:** Buy 1 Call (or Put) @ high strike C
- **Strike order:** A < B < C (equidistant)
- **Expiry:** All same
- **Type:** All calls or all puts
- **Outlook:** Neutral — expects stock to pin at B near expiry
- **Max Profit:** (B - A) minus net debit (achieved when stock = B at expiry)
- **Max Loss:** Net debit paid

---

### Condor

- **Leg 1:** Buy 1 Call (or Put) @ lowest strike A
- **Leg 2:** Sell 1 Call (or Put) @ lower-middle strike B
- **Leg 3:** Sell 1 Call (or Put) @ upper-middle strike C
- **Leg 4:** Buy 1 Call (or Put) @ highest strike D
- **Strike order:** A < B < C < D (equidistant)
- **Expiry:** All same
- **Type:** All calls or all puts (unlike Iron Condor which mixes)
- **Outlook:** Neutral / Range-bound — wider profit zone than butterfly
- **Max Profit:** Net credit received (stock stays between B and C)
- **Max Loss:** Width of outer spread minus net credit
- **Note:** Like a Long Butterfly but with the body split into two strikes, creating a wider profit zone

---

### Double Diagonal

- **Leg 1:** Sell near-term OTM Put @ strike B
- **Leg 2:** Buy far-term OTM Put @ strike A (lower than B)
- **Leg 3:** Sell near-term OTM Call @ strike C
- **Leg 4:** Buy far-term OTM Call @ strike D (higher than C)
- **Strike order:** A < B < C < D
- **Expiry:** Near-term for sold legs, far-term for bought legs (two different expirations)
- **Outlook:** Neutral near-term, expecting stock to stay between B and C
- **Max Profit:** When both short options expire worthless and long options retain value
- **Max Loss:** Net debit paid (limited)
- **Note:** Combination of two diagonal spreads — a put diagonal and a call diagonal. Benefits from time decay on the short legs while long legs provide protection.

---

## Quick Reference Summary

| Strategy         | Legs        | Expiry        | Outlook         | Risk      | Reward    |
| ---------------- | ----------- | ------------- | --------------- | --------- | --------- |
| Long Call        | 1           | Single        | Bullish         | Limited   | Unlimited |
| Long Put         | 1           | Single        | Bearish         | Limited   | Large     |
| Short Call       | 1           | Single        | Bearish/Neutral | Unlimited | Limited   |
| Short Put        | 1           | Single        | Bullish/Neutral | Large     | Limited   |
| Bull Call Spread | 2           | Same          | Mod. Bullish    | Limited   | Limited   |
| Bear Put Spread  | 2           | Same          | Mod. Bearish    | Limited   | Limited   |
| Bull Put Spread  | 2           | Same          | Mod. Bullish    | Limited   | Limited   |
| Bear Call Spread | 2           | Same          | Mod. Bearish    | Limited   | Limited   |
| Long Straddle    | 2           | Same          | High Vol        | Limited   | Unlimited |
| Short Straddle   | 2           | Same          | Low Vol         | Unlimited | Limited   |
| Long Strangle    | 2           | Same          | High Vol        | Limited   | Unlimited |
| Short Strangle   | 2           | Same          | Low Vol         | Unlimited | Limited   |
| Calendar Spread  | 2           | Different     | Neutral         | Limited   | Limited   |
| Diagonal Spread  | 2           | Different     | Directional     | Limited   | Limited   |
| Iron Condor      | 4           | Same          | Neutral         | Limited   | Limited   |
| Iron Butterfly   | 4           | Same          | Neutral         | Limited   | Limited   |
| Long Butterfly   | 4 (1/2/1)   | Same          | Neutral         | Limited   | Limited   |
| Condor           | 4 (1/1/1/1) | Same          | Neutral         | Limited   | Limited   |
| Double Diagonal  | 4           | Different (2) | Neutral         | Limited   | Limited   |
