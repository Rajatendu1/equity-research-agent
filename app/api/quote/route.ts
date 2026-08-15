import { NextResponse } from "next/server";

const aliases: Record<string, string> = {
  "asian paints": "ASIANPAINT", reliance: "RELIANCE", tcs: "TCS", infosys: "INFY",
  "hdfc bank": "HDFCBANK", icici: "ICICIBANK", itc: "ITC", sbi: "SBIN",
  "berger paints": "BERGEPAINT", berger: "BERGEPAINT", "kansai nerolac": "KANSAINER", nerolac: "KANSAINER",
};
const clean = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();
const number = (value: string | undefined) => {
  const parsed = Number(clean(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("symbol")?.trim() ?? "";
  if (!input) return NextResponse.json({ error: "Choose a company first." }, { status: 400 });
  const symbol = aliases[input.toLowerCase()] ?? input.toUpperCase().replace(/\.NS$|\.BO$/, "").replace(/\s+/g, "");
  try {
    const response = await fetch(`https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Vigilant research)" }, next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("Quote unavailable");
    const html = await response.text();
    const price = number(/Current Price[\s\S]{0,900}?<span class="number">\s*([^<]+)/i.exec(html)?.[1]);
    if (!price) throw new Error("Quote unavailable");
    return NextResponse.json({ symbol, price, asOf: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "The latest price could not be loaded right now." }, { status: 502 });
  }
}
