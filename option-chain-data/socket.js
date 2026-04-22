const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

// ── Load env from .env.local ──────────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  process.env[key.trim()] = rest.join("=").trim();
}

const BASE_URL = process.env.TASTY_BASE_URL;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// ── Fetch a fresh dxFeed token ────────────────────────────────────────────────
async function getDxFeedToken() {
  const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      client_secret: CLIENT_SECRET,
    }),
  });
  const { access_token } = await tokenRes.json();

  const quoteRes = await fetch(`${BASE_URL}/api-quote-tokens`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const { data } = await quoteRes.json();
  return { url: data["dxlink-url"], token: data.token };
}

// ── Stream quotes ─────────────────────────────────────────────────────────────
function streamQuotes(dxlinkUrl, token, symbols, onQuote, onTrade) {
  const ws = new WebSocket(dxlinkUrl);

  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        type: "SETUP",
        channel: 0,
        keepaliveTimeout: 60,
        acceptKeepaliveTimeout: 60,
        version: "0.1",
      }),
    );
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);

    if (msg.type === "SETUP") {
      ws.send(JSON.stringify({ type: "AUTH", channel: 0, token }));
    }

    if (msg.type === "AUTH_STATE" && msg.state === "AUTHORIZED") {
      ws.send(
        JSON.stringify({
          type: "CHANNEL_REQUEST",
          channel: 1,
          service: "FEED",
          parameters: { contract: "AUTO" },
        }),
      );
    }

    if (msg.type === "CHANNEL_OPENED" && msg.channel === 1) {
      ws.send(
        JSON.stringify({
          type: "FEED_SETUP",
          channel: 1,
          acceptAggregationPeriod: 0,
          acceptDataFormat: "COMPACT",
          acceptEventFields: {
            Quote: ["eventSymbol", "bidPrice", "askPrice"],
            Trade: ["eventSymbol", "price"],
          },
        }),
      );

      ws.send(
        JSON.stringify({
          type: "FEED_SUBSCRIPTION",
          channel: 1,
          reset: true,
          add: [
            ...symbols.map((s) => ({ type: "Quote", symbol: s })),
            { type: "Trade", symbol: "SPX" }, // ← SPX last price
          ],
        }),
      );
      console.log("Subscribed to:", symbols.join(", "));
    }

    if (msg.type === "FEED_DATA") {
      const [eventType, values] = msg.data;

      if (eventType === "Quote") {
        for (let i = 0; i < values.length; i += 3) {
          onQuote(values[i], values[i + 1], values[i + 2]);
        }
      }

      if (eventType === "Trade") {
        for (let i = 0; i < values.length; i += 2) {
          onTrade(values[i], values[i + 1]);
        }
      }
    }

    if (msg.type === "KEEPALIVE") {
      ws.send(JSON.stringify({ type: "KEEPALIVE", channel: 0 }));
    }
  });

  ws.on("error", (e) => console.error("WebSocket error:", e));
  ws.on("close", () => console.log("Connection closed"));

  return () => ws.close();
}

// ── Run ───────────────────────────────────────────────────────────────────────
const SYMBOLS = [
  ".SPX260515C6700",
  ".SPX260515C6750",
  ".SPX260515C6800",
  ".SPX",
  "SPX",
];

getDxFeedToken()
  .then(({ url, token }) => {
    console.log("Got fresh token, connecting to", url);
    const stop = streamQuotes(
      url,
      token,
      SYMBOLS,
      (symbol, bid, ask) => {
        console.log(
          `[Quote] ${symbol}  bid: ${bid}  ask: ${ask}  mid: ${((bid + ask) / 2).toFixed(2)}`,
        );
      },
      (symbol, price) => {
        console.log(`[Trade] ${symbol}  last: ${price}`); // ← SPX last price
      },
    );
  })
  .catch(console.error);
