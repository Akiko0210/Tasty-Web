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

### Short (Naked) Call

- **Action:** Sell a Call
- **Strike:** OTM typically
- **Expiry:** Single leg, one expiration
- **Outlook:** Bearish / Neutral
- **Max Profit:** Premium received
- **Max Loss:** Unlimited

---

### Short (Naked) Put

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

## Stock + Option Strategies

### Covered Call

- **Leg 1:** Long 100 shares of stock
- **Leg 2:** Sell 1 Call @ OTM strike
- **Expiry:** Any
- **Outlook:** Neutral to slightly Bullish
- **Max Profit:** (Strike - Stock purchase price) + premium received
- **Max Loss:** Stock price minus premium received

---

### Protective Put

- **Leg 1:** Long 100 shares of stock
- **Leg 2:** Buy 1 Put @ ATM or OTM strike
- **Expiry:** Any
- **Outlook:** Bullish but hedged
- **Max Profit:** Unlimited
- **Max Loss:** (Stock purchase price - Put strike) + premium paid

---

### Collar

- **Leg 1:** Long 100 shares of stock
- **Leg 2:** Buy Put @ OTM lower strike (protection)
- **Leg 3:** Sell Call @ OTM higher strike (income)
- **Expiry:** Same for options
- **Outlook:** Neutral — limits both upside and downside
- **Max Profit:** (Call strike - Stock price) + net credit/debit
- **Max Loss:** (Stock price - Put strike) + net credit/debit

---

## Four-Leg Strategies

### Iron Condor

- **Leg 1:** Sell OTM Put @ strike B
- **Leg 2:** Buy OTM Put @ strike A (lower, for protection)
- **Leg 3:** Sell OTM Call @ strike C
- **Leg 4:** Buy OTM Call @ strike D (higher, for protection)
- **Strike order:** A < B < C < D
- **Expiry:** All same
- **Outlook:** Neutral / Range-bound
- **Max Profit:** Net credit received
- **Max Loss:** Width of widest spread minus net credit

---

### Iron Butterfly

- **Leg 1:** Buy OTM Put @ lower strike A
- **Leg 2:** Sell ATM Put @ middle strike B
- **Leg 3:** Sell ATM Call @ middle strike B (same as Leg 2)
- **Leg 4:** Buy OTM Call @ higher strike C
- **Strike order:** A < B < C
- **Expiry:** All same
- **Outlook:** Neutral — expects stock to stay near ATM
- **Max Profit:** Net credit received (at expiry, stock = B)
- **Max Loss:** Width of spread minus net credit

---

### Long Butterfly Spread (All Calls or All Puts)

- **Leg 1:** Buy 1 option @ low strike A
- **Leg 2:** Sell 2 options @ middle strike B
- **Leg 3:** Buy 1 option @ high strike C
- **Strike order:** A < B < C (equidistant)
- **Expiry:** All same
- **Outlook:** Neutral — expects stock to pin at B
- **Max Profit:** Middle strike minus lower strike minus net debit
- **Max Loss:** Net debit paid

---

## Quick Reference Summary

| Strategy         | Legs      | Outlook      | Risk      | Reward    |
| ---------------- | --------- | ------------ | --------- | --------- |
| Long Call        | 1         | Bullish      | Limited   | Unlimited |
| Long Put         | 1         | Bearish      | Limited   | Large     |
| Bull Call Spread | 2         | Mod. Bullish | Limited   | Limited   |
| Bear Put Spread  | 2         | Mod. Bearish | Limited   | Limited   |
| Long Straddle    | 2         | High Vol     | Limited   | Unlimited |
| Short Strangle   | 2         | Low Vol      | Unlimited | Limited   |
| Covered Call     | Stock + 1 | Neutral      | High      | Limited   |
| Iron Condor      | 4         | Neutral      | Limited   | Limited   |
| Iron Butterfly   | 4         | Neutral      | Limited   | Limited   |
