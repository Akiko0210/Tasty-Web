# Tasty Web

> A Next.js trading terminal for Tastytrade — build multi-leg options strategies on live quotes, and trade them by voice.

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Tastytrade API" src="https://img.shields.io/badge/API-Tastytrade-0f9d58">
  <img alt="Claude voice agent" src="https://img.shields.io/badge/Voice-Claude-D97757">
</p>

Tasty Web turns a [Tastytrade](https://developer.tastytrade.com/) account into a focused browser terminal: pick a symbol, pick one of 19 predefined options/futures strategies, and the app assembles the legs around the live market for you. Live Bid/Mid/Ask is computed with Tastytrade's own spread-optimization logic, every ticket can be dry-run for buying power and fees before it goes out, and working orders can be replaced, mirrored, or cancelled from the orders screen. A floating mic button (`Alt+M`) puts the same actions behind a [Claude](https://console.anthropic.com/)-powered voice agent — say what you want to trade, and it builds, prices, and submits the ticket.

| | |
| --- | --- |
| **Build** | 19 strategies — singles, verticals, straddles/strangles, calendars/diagonals, condors/butterflies |
| **Price** | Live dxFeed quote stream, Tastytrade spread-optimized Bid/Mid/Ask, pre-flight dry runs |
| **Manage** | Positions, order history, working orders — replace, reverse, or cancel in one click |
| **Speak** | Browser speech-to-text → Claude tool calls → orders, quotes, and navigation, hands-free |
| **Markets** | Equity and index options (SPX, AAPL…) plus futures options (`/ES`, `/MES`) |

It's a thin client over the Tastytrade REST API and dxFeed quote stream — there's no database and no server-side persistence of your account data; state lives in the browser (localStorage) or is re-fetched from Tastytrade on each load.

## Features

### Strategy builder (`/[strategy]`, e.g. `/long-call`, `/iron-condor`)
The core screen. Pick a symbol (from your watchlist), pick one of 19 predefined strategies (single-leg calls/puts, verticals, straddles/strangles, calendars/diagonals, iron condors/butterflies, etc. — see [lib/constants.ts](lib/constants.ts) and [docs/identifyStrategy.md](docs/identifyStrategy.md)), and the app auto-builds the legs around the current price using the live option chain. From there you can:
- Edit individual legs (strike, expiration, side, quantity, open/close)
- See live Bid/Mid/Ask for the whole ticket, computed with Tastytrade's own spread-optimization logic for crossed markets (see [docs/Tastytrade_Pricing_Logic_Instruction.md](docs/Tastytrade_Pricing_Logic_Instruction.md))
- Dry-run the order (buying power effect, fees, warnings) before confirming
- Submit, or — when arriving via "Similar / Opposite / Replace" from the Orders page — replace an existing order
- Trade equity/index options (SPX, AAPL, …) or futures options (`/ES`, `/MES`), with a contract selector for the nearest futures expirations

Legs and the selected symbol are persisted per-strategy in localStorage so a ticket survives a refresh.

### Dashboard (`/dashboard`)
Your watchlist with live bid/ask/last prices. Add a symbol via the built-in search (`/api/search-symbols`, resolved against the Tastytrade instruments API) or remove one. The watchlist is stored server-side via `/api/watchlist` (not localStorage), so it's the same across devices/browsers.

### Positions (`/positions`)
Read-only view of everything currently open in the account — underlying, option/future details, quantity, direction, open price, and days to expiry — fetched live from Tastytrade.

### Orders / Activities (`/orders`)
History and working orders for a date range, with per-order leg breakdown, status, and price. Includes "Similar" (reopen this order's setup in the strategy builder), "Opposite" (prefill the closing trade), "Replace" (edit and resubmit a working order), and cancel.

### Voice agent
A floating mic button (bottom-right, `Alt+M` to toggle) available on every page. Speech is transcribed in-browser (Web Speech API — Chrome/Edge/Safari only, and only over HTTPS/localhost) and sent as text to `/api/voice-agent`, a thin proxy to the Claude Messages API (see [app/api/voice-agent/route.ts](app/api/voice-agent/route.ts)). Claude decides which tool to call (build a strategy, set a limit price, submit/confirm an order, look up a quote, list/cancel orders, navigate pages, …); the actual tool execution happens back in the browser (see [components/VoiceAgent.tsx](components/VoiceAgent.tsx)) since it needs live ticket state and quotes. Replies are read back with speech synthesis. Requires `ANTHROPIC_API_KEY`; without it the mic button still renders but explains it's not configured.

## How it works

- **`contexts/AppContext.tsx`** is the app's shared client state: account balance, the option-chain cache per symbol, a live quote stream (a WebSocket to dxFeed, authenticated via a Tastytrade-issued streamer token, auto-reconnecting), the watchlist, and cached order history.
- **`api/*.ts`** are Next.js Server Actions (`"use server"`) that wrap Tastytrade's REST API — auth/token refresh ([api/token.ts](api/token.ts)), balances, positions, orders (fetch/place/replace/cancel), and option/futures chains. These run server-side so your OAuth credentials never reach the browser.
- **`app/api/*/route.ts`** are a few real HTTP routes: `search-symbols` and `watchlist` (server-side watchlist storage) and `voice-agent` (the Claude proxy described above).
- **`lib/`** holds strategy/leg construction logic (`utils.ts`), shared types (`types.ts`), strategy/symbol config (`constants.ts`), and the voice agent's tool definitions, system prompt, symbol resolution, and speech helpers (`lib/voice/`).
- **`components/`** holds the shared UI: the sidebar/nav, the strategy dropdown, leg row/card editors, the order confirmation modal, and the voice agent widget.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your own credentials:

```bash
cp .env.example .env
```

`.env` is git-ignored — never commit it or paste real credentials into a commit, issue, or PR.

| Variable | Description |
| --- | --- |
| `TASTYWORKS_ACCOUNT_ID` | Your Tastytrade account number |
| `REFRESH_TOKEN` | OAuth refresh token from your [Tastytrade developer app](https://developer.tastytrade.com/) |
| `CLIENT_SECRET` | OAuth client secret for your Tastytrade developer app |
| `TASTY_BASE_URL` | `https://api.tastyworks.com` for production, or `https://api.cert.tastyworks.com` for the sandbox |
| `TASTYTRADE_TOKEN` | Session token (or leave blank and let the app refresh one using `REFRESH_TOKEN`) |
| `TASTYTRADE_IS_TEST` | Set to `True` to target the Tastytrade sandbox environment |
| `ANTHROPIC_API_KEY` | Required only for the voice agent (`/api/voice-agent`) — get one from the [Anthropic Console](https://console.anthropic.com/) |
| `ANTHROPIC_VOICE_MODEL` | Optional model override for the voice agent (defaults to `claude-opus-4-8`) |

### 3. Run the development server

The dev server runs over HTTPS (see `certificates/`, also git-ignored) — this is required for the voice agent's microphone access:

```bash
npm run dev
```

Open [https://localhost:3000](https://localhost:3000) in your browser. Your browser will warn about the self-signed certificate the first time — accept it to continue. Voice input only works on `localhost` or a real HTTPS origin, not a raw network IP.

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # lint the project
```

## Security notes

- Do not commit `.env`, anything under `certificates/`, or any file containing API keys/tokens. Both are already excluded via `.gitignore`.
- If a credential is ever accidentally committed, rotate it immediately (regenerate the Tastytrade client secret/tokens and the Anthropic API key) — removing it from a future commit does not remove it from git history.
- This app places real orders against whatever account `TASTYWORKS_ACCOUNT_ID` / `TASTY_BASE_URL` point at. Use the sandbox (`api.cert.tastyworks.com`) while developing unless you mean to trade a live account.

## Learn More

- [Tastytrade API docs](https://developer.tastytrade.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- Pricing/strategy internals: [docs/Tastytrade_Pricing_Logic_Instruction.md](docs/Tastytrade_Pricing_Logic_Instruction.md), [docs/identifyStrategy.md](docs/identifyStrategy.md), [docs/es_trading_integration.md](docs/es_trading_integration.md)
