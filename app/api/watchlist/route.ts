import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "data/watchlist.json");

async function read(): Promise<string[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return ["SPX", "/ES"];
  }
}

export async function GET() {
  return NextResponse.json(await read());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!Array.isArray(body.symbols)) {
    return NextResponse.json({ error: "symbols must be an array" }, { status: 400 });
  }
  const symbols: string[] = body.symbols.filter(
    (s: unknown) => typeof s === "string" && s.trim().length > 0,
  );
  await writeFile(FILE, JSON.stringify(symbols, null, 2));
  return NextResponse.json(symbols);
}
