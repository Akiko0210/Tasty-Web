import { NextResponse } from "next/server";
import { bearerToken, requestToken } from "@/api/token";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const token = await requestToken();
    const headers = { Authorization: bearerToken(token), "User-Agent": "my-app/1.0" };

    if (q.startsWith("/")) {
      // Futures: validate by checking the chain endpoint (same as the app uses internally)
      const productCode = q.slice(1);
      const res = await fetch(
        `${process.env.TASTY_BASE_URL}/futures-option-chains/${productCode}/nested`,
        { headers },
      );
      if (!res.ok) return NextResponse.json({ found: false });
      return NextResponse.json({ found: true, symbol: q, description: `${productCode} Futures` });
    }

    // Equity
    const res = await fetch(
      `${process.env.TASTY_BASE_URL}/instruments/equities?symbol[]=${encodeURIComponent(q)}`,
      { headers },
    );
    if (!res.ok) return NextResponse.json({ found: false });
    const { data } = await res.json();
    const items: { symbol: string; description?: string }[] = data?.items ?? [];
    const item = items.find((i) => i.symbol === q);
    if (!item) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, symbol: item.symbol, description: item.description ?? "" });
  } catch {
    return NextResponse.json({ found: false });
  }
}
