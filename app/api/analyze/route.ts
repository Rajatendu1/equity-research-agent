import { NextResponse } from "next/server";
import {
  aiReportJsonSchema,
  parseStructuredAnalysis,
} from "./structured-output";

const aliases: Record<string, string> = {
  "asian paints": "ASIANPAINT",
  reliance: "RELIANCE",
  tcs: "TCS",
  infosys: "INFY",
  "hdfc bank": "HDFCBANK",
  icici: "ICICIBANK",
  itc: "ITC",
  sbi: "SBIN",
  "berger paints": "BERGEPAINT",
  berger: "BERGEPAINT",
  "kansai nerolac": "KANSAINER",
  "kansai nerolac paints": "KANSAINER",
  nerolac: "KANSAINER",
  cupid: "CUPID",
  "cupid ltd": "CUPID",
  "cupid limited": "CUPID",
};
async function resolveCompanyCode(input: string) {
  const direct = aliases[input.toLowerCase()];
  if (direct) return direct;
  const fallback = input
    .toUpperCase()
    .replace(/\.NS$|\.BO$/, "")
    .replace(/\s+/g, "");
  try {
    const response = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(input)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Vigilant research)" }, next: { revalidate: 3600 } },
    );
    if (!response.ok) return fallback;
    const matches = (await response.json()) as Array<{ name?: string; url?: string }>;
    const key = input.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = matches.find((item) => item.name?.toLowerCase().replace(/[^a-z0-9]/g, "").includes(key)) ?? matches[0];
    const code = /\/company\/([^/]+)\//.exec(match?.url ?? "")?.[1];
    return code ? decodeURIComponent(code) : fallback;
  } catch {
    return fallback;
  }
}
const verdicts = [
  "Potentially investable",
  "Wait / watchlist",
  "Avoid",
  "Insufficient evidence",
] as const;
type Point = { date: string; close: number; volume: number | null };
type FinancialPoint = {
  period: string;
  revenue: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  borrowings: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
};
type QuarterlyPoint = {
  period: string;
  revenue: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
};
type AiReport = {
  verdict: (typeof verdicts)[number];
  summary: string;
  positives: string[];
  risks: string[];
  marketExpectations: string;
  assumptions: string[];
  invalidation: string[];
  nextChecks: string[];
  financialRead: string;
  valuationRead: string;
  governanceRead: string;
  missingData: string[];
};
type Consensus = {
  available: boolean;
  provider: string;
  sourceUrl: string;
  rating: string | null;
  analystCount: number | null;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  asOf: string | null;
  note: string;
};

const strip = (value: unknown) =>
  String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const asNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const ratio = (html: string, label: string) =>
  asNumber(
    strip(
      new RegExp(
        `${label}[\\s\\S]{0,900}?<span class="number">\\s*([^<]+)`,
        "i",
      ).exec(html)?.[1],
    ),
  );
const description = (html: string) =>
  strip(/<meta name="description" content="([\s\S]*?)"/.exec(html)?.[1]);
const described = (text: string, label: string) =>
  asNumber(new RegExp(`${label}:\\s*([0-9,.]+)`, "i").exec(text)?.[1]);
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const standardDeviation = (values: number[]) => {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
};
const sma = (values: number[], days: number) =>
  values.length >= days ? average(values.slice(-days)) : null;
const emaSeries = (values: number[], days: number) => {
  const multiplier = 2 / (days + 1);
  let current = values[0];
  return values.map(
    (value) => (current = current + (value - current) * multiplier),
  );
};
const safeText = (value: string) =>
  strip(value.replace(/<!\[CDATA\[|\]\]>/g, ""));
const decode = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const strings = (value: unknown, limit = 3) =>
  (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim().slice(0, 700)
    : fallback;
const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

async function thirdPartyConsensus(symbol: string): Promise<Consensus> {
  const sourceUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}.NS/analysis/`,
    fallback = {
      available: false,
      provider: "Yahoo Finance",
      sourceUrl,
      rating: null,
      analystCount: null,
      targetMean: null,
      targetLow: null,
      targetHigh: null,
      asOf: null,
      note: "No usable third-party analyst consensus was available for this NSE code.",
    };
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}.NS?modules=financialData,recommendationTrend`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Vigilant research)",
        },
        next: { revalidate: 3600 },
      },
    );
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
        quoteSummary?: {
          result?: Array<{
            financialData?: Record<string, { raw?: number }>;
            recommendationTrend?: {
              trend?: Array<Record<string, number | string>>;
            };
          }>;
        };
      },
      result = data.quoteSummary?.result?.[0],
      financial = result?.financialData,
      trend = result?.recommendationTrend?.trend?.[0];
    const targetMean = finite(financial?.targetMeanPrice?.raw),
      targetLow = finite(financial?.targetLowPrice?.raw),
      targetHigh = finite(financial?.targetHighPrice?.raw),
      analystCount =
        finite(financial?.numberOfAnalystOpinions?.raw) ??
        (trend
          ? ["strongBuy", "buy", "hold", "sell", "strongSell"].reduce(
              (sum, key) => sum + (finite(trend[key]) ?? 0),
              0,
            )
          : null),
      mean = finite(financial?.recommendationMean?.raw);
    const rating =
      mean === null
        ? null
        : mean <= 1.5
          ? "Strong buy"
          : mean <= 2.5
            ? "Buy"
            : mean <= 3.5
              ? "Hold"
              : mean <= 4.5
                ? "Underperform"
                : "Sell";
    if (targetMean === null && rating === null) return fallback;
    return {
      available: true,
      provider: "Yahoo Finance",
      sourceUrl,
      rating,
      analystCount,
      targetMean,
      targetLow,
      targetHigh,
      asOf: new Date().toISOString(),
      note: "Published analyst consensus can be sparse, stale, or unavailable for Indian listings; it is shown as external context, not a recommendation.",
    };
  } catch {
    return fallback;
  }
}

function classifyEvent(title: string) {
  const value = title.toLowerCase();
  if (/result|earnings|quarter|q[1-4]|profit|revenue|sales|margin/.test(value))
    return {
      category: "Results",
      tone: /beat|surge|rise|growth|record|strong/.test(value)
        ? "Positive"
        : /miss|fall|drop|decline|weak/.test(value)
          ? "Negative"
          : "Watch",
    };
  if (/upgrade|downgrade|target price|brokerage|analyst/.test(value))
    return {
      category: "Analyst view",
      tone: /upgrade|buy|outperform/.test(value)
        ? "Positive"
        : /downgrade|sell|underperform/.test(value)
          ? "Negative"
          : "Watch",
    };
  if (/court|regulator|sebi|notice|penalt|governance|fraud|probe/.test(value))
    return {
      category: "Regulation",
      tone: /penalt|fraud|probe|court|notice/.test(value)
        ? "Negative"
        : "Watch",
    };
  if (
    /acquisition|merger|capex|expansion|plant|launch|contract|order/.test(value)
  )
    return {
      category: "Business event",
      tone: /win|launch|expansion|order/.test(value) ? "Positive" : "Watch",
    };
  return {
    category: "Market context",
    tone: /gain|rally|rise|up/.test(value)
      ? "Positive"
      : /fall|slip|drop|down/.test(value)
        ? "Negative"
        : "Watch",
  };
}
function parseNews(xml: string) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .slice(0, 4)
    .map((match) => {
      const item = match[1],
        title = decode(
          safeText(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? ""),
        ),
        link = decode(
          safeText(/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? ""),
        ),
        date = safeText(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] ?? "");
      return title && link
        ? { title, link, date, ...classifyEvent(title) }
        : null;
    })
    .filter(
      (
        item,
      ): item is {
        title: string;
        link: string;
        date: string;
        category: string;
        tone: string;
      } => Boolean(item),
    );
}
function sectionTable(html: string, id: string) {
  const section =
    new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`, "i").exec(
      html,
    )?.[0] ?? "";
  const periods = [
    ...section.matchAll(/<th[^>]*data-date-key="([^"]+)"[\s\S]*?<\/th>/g),
  ]
    .map((match) => strip(match[1]))
    .filter((period) => /^\d{4}-03-31$/.test(period));
  const rows = new Map<string, Array<number | null>>();
  for (const match of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (cell) => asNumber(strip(cell[1])),
    );
    const label = strip(match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1])
      .replace(/\+/g, "")
      .trim();
    if (label && cells.length > 1) rows.set(label, cells.slice(1));
  }
  return { periods, rows };
}
const valueAt = (
  rows: Map<string, Array<number | null>>,
  label: string,
  index: number,
) => rows.get(label)?.[index] ?? null;
function financialEvidence(html: string) {
  const pnl = sectionTable(html, "profit-loss"),
    balance = sectionTable(html, "balance-sheet"),
    cash = sectionTable(html, "cash-flow");
  const periods = pnl.periods.slice(-5),
    offset = pnl.periods.length - periods.length;
  const points: FinancialPoint[] = periods.map((period, i) => ({
    period: period.slice(0, 4),
    revenue: valueAt(pnl.rows, "Sales", offset + i),
    operatingProfit: valueAt(pnl.rows, "Operating Profit", offset + i),
    netProfit: valueAt(pnl.rows, "Net Profit", offset + i),
    borrowings: valueAt(
      balance.rows,
      "Borrowings",
      balance.periods.indexOf(period),
    ),
    operatingCashFlow: valueAt(
      cash.rows,
      "Cash from Operating Activity",
      cash.periods.indexOf(period),
    ),
    capex: valueAt(
      cash.rows,
      "Fixed assets purchased",
      cash.periods.indexOf(period),
    ),
  }));
  const latest = points.at(-1),
    previous = points.at(-2),
    growth = (now: number | null, then: number | null) =>
      now !== null && then !== null && then !== 0
        ? (now / then - 1) * 100
        : null;
  const margin = (profit: number | null, revenue: number | null) =>
    profit !== null && revenue !== null && revenue !== 0
      ? (profit / revenue) * 100
      : null;
  const revenueCagr =
    points[0]?.revenue && latest?.revenue && points.length > 1
      ? ((latest.revenue / points[0].revenue) ** (1 / (points.length - 1)) -
          1) *
        100
      : null;
  const quarterSection = /<section id="quarters"[\s\S]*?<\/section>/i.exec(html)?.[0] ?? "";
  const quarterPeriods = [...quarterSection.matchAll(/<th[^>]*data-date-key="([^"]+)"[\s\S]*?<\/th>/g)]
    .map((match) => strip(match[1]))
    .filter((period) => /^\d{4}-\d{2}-\d{2}$/.test(period));
  const quarterRows = new Map<string, Array<number | null>>();
  for (const match of quarterSection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => asNumber(strip(cell[1])));
    const label = strip(match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1]).replace(/\+/g, "").trim();
    if (label && cells.length > 1) quarterRows.set(label, cells.slice(1));
  }
  const quarterOffset = Math.max(0, quarterPeriods.length - 5);
  const quarters: QuarterlyPoint[] = quarterPeriods.slice(-5).map((period, index) => ({
    period,
    revenue: valueAt(quarterRows, "Sales", quarterOffset + index),
    operatingProfit: valueAt(quarterRows, "Operating Profit", quarterOffset + index),
    netProfit: valueAt(quarterRows, "Net Profit", quarterOffset + index),
  }));
  return {
    annual: points,
    quarters,
    metrics: {
      revenueGrowth: growth(latest?.revenue ?? null, previous?.revenue ?? null),
      profitGrowth: growth(
        latest?.netProfit ?? null,
        previous?.netProfit ?? null,
      ),
      operatingMargin: margin(
        latest?.operatingProfit ?? null,
        latest?.revenue ?? null,
      ),
      netMargin: margin(latest?.netProfit ?? null, latest?.revenue ?? null),
      revenueCagr,
      cashConversion:
        latest?.netProfit && latest.operatingCashFlow !== null
          ? latest.operatingCashFlow / latest.netProfit
          : null,
      debtToOperatingProfit:
        latest?.borrowings !== null && latest?.operatingProfit
          ? latest.borrowings / latest.operatingProfit
          : null,
    },
    available: points.filter((point) => point.revenue !== null).length >= 3,
  };
}
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b),
    position = (sorted.length - 1) * p,
    lower = Math.floor(position),
    upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};
function regimeAt(points: Point[], end: number, periodsPerYear: number) {
  const data = points.slice(0, end + 1),
    closes = data.map((point) => point.close),
    last = closes.at(-1) ?? 0,
    returns = closes
      .slice(1)
      .map((value, index) => Math.log(value / closes[index]));
  const ma4 = sma(closes, 4),
    ma13 = sma(closes, 13),
    ma52 = sma(closes, 52),
    fast = emaSeries(closes, 4).at(-1) ?? last,
    slow = emaSeries(closes, 13).at(-1) ?? last;
  const gains = returns.map((value) => Math.max(value, 0)),
    losses = returns.map((value) => Math.max(-value, 0)),
    gain = average(gains.slice(-14)),
    loss = average(losses.slice(-14)),
    rsi = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  const volumes = data
      .map((point) => point.volume)
      .filter((value): value is number => value !== null && value > 0),
    recentVolume = average(volumes.slice(-4)),
    baselineVolume = average(volumes.slice(-13)),
    volumeRatio =
      recentVolume && baselineVolume ? recentVolume / baselineVolume : null;
  const score =
    (ma4 && last > ma4 ? 1 : -1) +
    (ma13 && last > ma13 ? 1 : -1) +
    (ma52 && last > ma52 ? 1 : -1) +
    (fast > slow ? 1 : -1) +
    (rsi >= 55 ? 1 : rsi <= 45 ? -1 : 0) +
    (volumeRatio && volumeRatio > 1.15 && last > (ma13 ?? last)
      ? 1
      : volumeRatio && volumeRatio > 1.15 && last < (ma13 ?? last)
        ? -1
        : 0);
  return {
    last,
    ma4,
    ma13,
    ma52,
    fast,
    slow,
    rsi,
    volumeRatio,
    score,
    volatility:
      returns.length > 5
        ? standardDeviation(returns.slice(-13)) * Math.sqrt(periodsPerYear)
        : null,
  };
}
function calculateMarket(points: Point[]) {
  const gaps = points
      .slice(1)
      .map((point, index) =>
        Math.max(
          1,
          (new Date(point.date).getTime() -
            new Date(points[index].date).getTime()) /
            86400000,
        ),
      )
      .filter(Number.isFinite),
    medianGap = percentile(gaps, 0.5),
    periodsPerYear = Math.max(12, Math.round(365 / medianGap)),
    current = regimeAt(points, points.length - 1, periodsPerYear),
    closes = points.map((point) => point.close),
    last = current.last;
  const change = (periods: number) =>
      closes.length > periods
        ? (last / (closes.at(-periods - 1) ?? last) - 1) * 100
        : null,
    horizonWeeks = 13,
    candidates: Array<{
      score: number;
      rsi: number;
      volumeRatio: number | null;
      outcome: number;
    }> = [];
  for (let index = 52; index + horizonWeeks < points.length; index += 2) {
    const snapshot = regimeAt(points, index, periodsPerYear),
      outcome = Math.log(
        points[index + horizonWeeks].close / points[index].close,
      );
    candidates.push({ ...snapshot, outcome });
  }
  const zone = (rsi: number) => (rsi < 42 ? -1 : rsi > 58 ? 1 : 0),
    sign = (value: number) => (value > 0 ? 1 : value < 0 ? -1 : 0);
  let matches = candidates.filter(
    (item) =>
      sign(item.score) === sign(current.score) &&
      Math.abs(item.score - current.score) <= 2 &&
      zone(item.rsi) === zone(current.rsi),
  );
  if (matches.length < 12)
    matches = candidates.filter(
      (item) =>
        sign(item.score) === sign(current.score) &&
        Math.abs(item.score - current.score) <= 3,
    );
  if (matches.length < 8) matches = candidates;
  const outcomes = matches.map((item) => item.outcome),
    threshold = Math.max(0.025, standardDeviation(outcomes) * 0.35),
    cautious = outcomes.filter((value) => value <= -threshold).length,
    upside = outcomes.filter((value) => value >= threshold).length,
    base = Math.max(0, outcomes.length - cautious - upside),
    toPct = (count: number) =>
      Math.round((count / Math.max(outcomes.length, 1)) * 100),
    cautiousPct = toPct(cautious),
    upsidePct = toPct(upside),
    basePct = Math.max(0, 100 - cautiousPct - upsidePct),
    priceAt = (ret: number) => Math.max(0, last * Math.exp(ret));
  const trend =
      current.score >= 3
        ? "Positive trend"
        : current.score <= -3
          ? "Weak trend"
          : "Mixed trend",
    volumeSignal =
      current.volumeRatio === null
        ? "Unavailable"
        : current.volumeRatio > 1.15
          ? current.score > 0
            ? "Confirming"
            : "Elevated"
          : current.volumeRatio < 0.8
            ? "Muted"
            : "Normal";
  const signals = [
    {
      name: "Trend",
      direction:
        current.score >= 3
          ? "Positive"
          : current.score <= -3
            ? "Negative"
            : "Neutral",
      detail: `Price versus 1-, 3- and 12-month weekly averages.`,
    },
    {
      name: "Momentum",
      direction: current.fast > current.slow ? "Positive" : "Negative",
      detail: `4-week trend is ${current.fast > current.slow ? "above" : "below"} the 13-week trend.`,
    },
    {
      name: "RSI",
      direction:
        current.rsi >= 55
          ? "Positive"
          : current.rsi <= 45
            ? "Negative"
            : "Neutral",
      detail: `14-week RSI is ${current.rsi.toFixed(0)}.`,
    },
    {
      name: "Volume",
      direction:
        volumeSignal === "Confirming"
          ? "Positive"
          : volumeSignal === "Elevated"
            ? "Negative"
            : "Neutral",
      detail:
        current.volumeRatio === null
          ? "Weekly volume was not available."
          : `Recent volume is ${(current.volumeRatio * 100).toFixed(0)}% of its 13-week average.`,
    },
  ];
  return {
    last,
    history: points,
    indicators: {
      trend,
      trendScore: current.score,
      rsi: current.rsi,
      return4: change(4),
      return13: change(13),
      volatility: current.volatility ? current.volatility * 100 : null,
      support: Math.min(...closes.slice(-13)),
      resistance: Math.max(...closes.slice(-13)),
      sma4: current.ma4,
      sma13: current.ma13,
      sma52: current.ma52,
      volumeRatio: current.volumeRatio,
      volumeSignal,
      signals,
    },
    scenarios: [
      {
        label: "Cautious",
        price: priceAt(percentile(outcomes, 0.2)),
        probability: cautiousPct,
        reason:
          "Lower fifth of outcomes after similar historical weekly setups.",
      },
      {
        label: "Central",
        price: priceAt(percentile(outcomes, 0.5)),
        probability: basePct,
        reason: "Middle historical outcome from similar weekly setups.",
      },
      {
        label: "Upside",
        price: priceAt(percentile(outcomes, 0.8)),
        probability: upsidePct,
        reason:
          "Upper fifth of outcomes after similar historical weekly setups.",
      },
    ],
    backtest: {
      sampleSize: outcomes.length,
      horizonWeeks,
      medianReturn: percentile(outcomes, 0.5) * 100,
      winRate: toPct(outcomes.filter((value) => value > 0).length),
      downsideRate: cautiousPct,
      matchingRule: "Trend direction, RSI zone and volume regime",
    },
  };
}
function decisionEngine(
  market: ReturnType<typeof calculateMarket>,
  financials: ReturnType<typeof financialEvidence>,
  eventCount: number,
) {
  const trend =
    market.indicators.trendScore >= 3
      ? "Supportive"
      : market.indicators.trendScore <= -3
        ? "Defensive"
        : "Mixed";
  const meanReversion =
    market.indicators.rsi < 35
      ? "Oversold watch"
      : market.indicators.rsi > 65
        ? "Extended"
        : "Neutral";
  const breakout =
    market.last >= market.indicators.resistance * 0.985
      ? market.indicators.volumeSignal === "Confirming"
        ? "Confirmed"
        : "Needs volume"
      : "Not active";
  const historical =
    market.backtest.winRate >= 58 && market.backtest.medianReturn > 0
      ? "Supportive"
      : market.backtest.winRate <= 42 || market.backtest.medianReturn < 0
        ? "Defensive"
        : "Mixed";
  const financeChecks = [
    financials.metrics.revenueGrowth !== null &&
      financials.metrics.revenueGrowth > 0,
    financials.metrics.profitGrowth !== null &&
      financials.metrics.profitGrowth > 0,
    financials.metrics.cashConversion !== null &&
      financials.metrics.cashConversion >= 0.8,
    financials.metrics.debtToOperatingProfit !== null &&
      financials.metrics.debtToOperatingProfit < 3,
  ].filter(Boolean).length;
  const fundamentals = !financials.available
    ? "Unavailable"
    : financeChecks >= 3
      ? "Supportive"
      : financeChecks <= 1
        ? "Defensive"
        : "Mixed";
  const volatility = market.indicators.volatility ?? 0,
    risk =
      volatility >= 45 || market.backtest.downsideRate >= 45
        ? "High"
        : volatility >= 27 || market.backtest.downsideRate >= 30
          ? "Moderate"
          : "Lower";
  const directions = [
    trend,
    historical,
    fundamentals,
    breakout === "Confirmed"
      ? "Supportive"
      : breakout === "Needs volume"
        ? "Mixed"
        : "Neutral",
  ].filter((value) => value !== "Unavailable" && value !== "Neutral");
  const supportive = directions.filter(
      (value) => value === "Supportive",
    ).length,
    defensive = directions.filter((value) => value === "Defensive").length;
  const agreement =
    supportive >= 3
      ? "Strong agreement"
      : defensive >= 3
        ? "Strong caution"
        : Math.abs(supportive - defensive) >= 2
          ? supportive > defensive
            ? "Leaning constructive"
            : "Leaning cautious"
          : "Mixed evidence";
  return {
    agreement,
    risk,
    models: [
      {
        name: "Trend strength",
        signal: trend,
        plain: "Is the broader price direction helping or hurting?",
        method:
          "Close versus 4-, 13- and 52-week moving averages, plus momentum.",
      },
      {
        name: "Pullback check",
        signal: meanReversion,
        plain: "Is the stock stretched or temporarily weak?",
        method: "14-week RSI measures the balance of recent gains and losses.",
      },
      {
        name: "Breakout quality",
        signal: breakout,
        plain: "Is price crossing resistance with participation?",
        method: "Price near the 13-week high, checked against recent volume.",
      },
      {
        name: "Historical setup",
        signal: historical,
        plain: "How did comparable weekly setups behave?",
        method: `${market.backtest.sampleSize} matched periods; next ${market.backtest.horizonWeeks}-week returns.`,
      },
      {
        name: "Business support",
        signal: fundamentals,
        plain: "Do growth, cash and debt broadly support the chart?",
        method:
          "Revenue, profit, cash conversion and debt checks from available annual data.",
      },
    ],
    sourceHealth: {
      market: "Available",
      financials: financials.available ? "Available" : "Partial",
      events: eventCount ? "Available" : "Unavailable",
    },
  };
}
function actionView(
  facts: { price: number | null },
  market: ReturnType<typeof calculateMarket>,
  financials: ReturnType<typeof financialEvidence>,
  consensus: Consensus,
) {
  const entryPrice = facts.price ?? market.last,
    central =
      market.scenarios.find((item) => item.label === "Central")?.price ??
      entryPrice,
    centralReturn = entryPrice > 0 ? (central / entryPrice - 1) * 100 : 0,
    financeSignals = [
      financials.metrics.revenueGrowth !== null &&
        financials.metrics.revenueGrowth > 0,
      financials.metrics.profitGrowth !== null &&
        financials.metrics.profitGrowth > 0,
      financials.metrics.cashConversion !== null &&
        financials.metrics.cashConversion >= 0.8,
    ].filter(Boolean).length,
    constructive =
      market.indicators.trendScore >= 3 &&
      market.backtest.winRate >= 52 &&
      centralReturn > 1 &&
      financeSignals >= 2,
    defensive =
      market.indicators.trendScore <= -3 &&
      (market.backtest.medianReturn < -2 || market.backtest.downsideRate >= 50);
  const stance = defensive
    ? "Consider reducing"
    : constructive
      ? "Consider buying"
      : market.indicators.trendScore >= 2
        ? "Hold / wait for confirmation"
        : "Wait for confirmation";
  const rationale = [
    market.indicators.trendScore >= 3
      ? "Trend and momentum are constructive on the weekly signal set."
      : market.indicators.trendScore <= -3
        ? "Trend and momentum remain weak on the weekly signal set."
        : "The weekly signal set is mixed, so price confirmation matters.",
    market.backtest.medianReturn >= 0
      ? `Similar historical setups had a median ${market.backtest.horizonWeeks}-week outcome of +${market.backtest.medianReturn.toFixed(1)}%.`
      : `Similar historical setups had a median ${market.backtest.horizonWeeks}-week outcome of ${market.backtest.medianReturn.toFixed(1)}%.`,
    financeSignals >= 2
      ? "Reported growth/cash checks are broadly supportive."
      : "Financial support is incomplete or mixed, so the market signal alone is not enough.",
  ];
  const externalUpside =
      consensus.targetMean !== null && entryPrice > 0
        ? (consensus.targetMean / entryPrice - 1) * 100
        : null,
    comparison = !consensus.available
      ? "No usable external analyst consensus is available, so this view relies only on the sourced company, market and news evidence."
      : externalUpside !== null &&
          externalUpside > 10 &&
          stance !== "Consider buying"
        ? `External consensus appears more optimistic, but Vigilant does not follow it because the current trend, historical setup or financial checks do not yet support acting on that upside.`
        : externalUpside !== null &&
            externalUpside < -5 &&
            stance === "Consider buying"
          ? `External consensus is more cautious, but the current evidence is constructive; the gap is a reason to size carefully and verify the latest estimates.`
          : "External consensus and the current evidence are broadly aligned; Vigilant still prioritises live price, financial and risk evidence over targets.";
  return {
    stance,
    entryPrice,
    horizonWeeks: market.backtest.horizonWeeks,
    outcomes: market.scenarios.map((item) => ({
      ...item,
      returnPct: entryPrice > 0 ? (item.price / entryPrice - 1) * 100 : null,
      rupeeChange: item.price - entryPrice,
    })),
    rationale,
    conditions: defensive
      ? [
          "Reassess if price regains the 13-week range and momentum improves.",
          "Do not treat this as a sell instruction; check tax, portfolio weight and your thesis.",
        ]
      : constructive
        ? [
            "Verify the next reported results and any material news before adding.",
            "A break below the recent 13-week support would weaken the setup.",
          ]
        : [
            "Wait for trend confirmation and the next material company update.",
            "Reassess if price breaks the recent 13-week resistance with sustained volume.",
          ],
    consensus,
    comparison,
    disclaimer:
      "Research guidance only, not a personalised buy, sell or hold recommendation. It does not consider your portfolio, tax position, time horizon or risk capacity.",
  };
}
function evidenceConfidence(
  facts: {
    pe: number | null;
    roce: number | null;
    roe: number | null;
    revenueCr: number | null;
    profitCr: number | null;
  },
  history: Point[],
  eventCount: number,
  hasFinancials: boolean,
) {
  let score = 30;
  const available: string[] = ["Company snapshot and five-year price history"];
  if (history.length >= 52) {
    score += 15;
    available.push("At least one year of weekly market history");
  }
  if (history.length >= 156) {
    score += 5;
    available.push("Multi-year market history");
  }
  if (facts.pe !== null && facts.roce !== null && facts.roe !== null) {
    score += 10;
    available.push("Core valuation and return ratios");
  }
  if (facts.revenueCr !== null && facts.profitCr !== null) {
    score += 5;
    available.push("Reported revenue and profit snapshot");
  }
  if (hasFinancials) {
    score += 12;
    available.push(
      "Five years of structured profit, balance-sheet and cash-flow data",
    );
  }
  if (eventCount > 0) {
    score += 3;
    available.push("Recent linked news headlines");
  }
  return {
    score: Math.min(80, score),
    available,
    limitations: [
      "Statement tables are sourced from Screener.in and are not a substitute for checking company filings.",
      "News headlines are context only; they are not independently verified evidence.",
    ],
  };
}
function normaliseReport(value: unknown): AiReport {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const verdict = verdicts.includes(raw.verdict as AiReport["verdict"])
    ? (raw.verdict as AiReport["verdict"])
    : "Insufficient evidence";
  return {
    verdict,
    summary: text(
      raw.summary,
      "The available snapshot is incomplete; treat this as a starting point for further checks.",
    ),
    positives: strings(raw.positives),
    risks: strings(raw.risks),
    marketExpectations: text(
      raw.marketExpectations,
      "Compare valuation and price action with verified results before drawing a conclusion.",
    ),
    assumptions: strings(raw.assumptions),
    invalidation: strings(raw.invalidation),
    nextChecks: strings(raw.nextChecks),
    financialRead: text(
      raw.financialRead,
      "Financial detail is limited to the reported snapshot; verify filings before relying on it.",
    ),
    valuationRead: text(
      raw.valuationRead,
      "Valuation is a point-in-time ratio, not a recommendation.",
    ),
    governanceRead: text(
      raw.governanceRead,
      "No primary governance or disclosure review was performed in this snapshot.",
    ),
    missingData: strings(raw.missingData, 5),
  };
}
const NVIDIA_MODELS = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "NVIDIA Nemotron 3 Super",
  },
] as const;

async function requestNvidiaAnalysis(
  prompt: string,
  apiKey: string,
  model: (typeof NVIDIA_MODELS)[number],
) {
  const controller = new AbortController(),
    // Mobile requests can disconnect while Ultra is still queued. Super is the
    // high-volume model; fall back to the local evidence engine after 10s.
    timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 1000,
          stream: false,
          structured_outputs: { json: aiReportJsonSchema },
          chat_template_kwargs: {
            enable_thinking: false,
            force_nonempty_content: true,
          },
        }),
      },
    );
  } catch {
    throw new Error(
      `${model.label} did not respond in time.`,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const issue = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      `${model.label} provider error (${response.status}): ${issue?.error?.message?.replace(/\s+/g, " ").slice(0, 220) ?? "provider error"}`,
    );
  }
  const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    },
    output = data.choices?.[0]?.message?.content?.trim();
  if (!output)
    throw new Error(
      `${model.label} returned no usable text analysis.`,
    );
  return {
    parsed: parseStructuredAnalysis(output),
    model: model.id,
  };
}
async function requestAnalysis(prompt: string) {
  if (!process.env.NVIDIA_API_KEY)
    throw new Error("NVIDIA_API_KEY is not configured for this site.");
  const failures: string[] = [];
  for (const model of NVIDIA_MODELS) {
    try {
      const result = await requestNvidiaAnalysis(
        prompt,
        process.env.NVIDIA_API_KEY,
        model,
      );
      return {
        ...result,
        warnings: [],
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : model.label);
    }
  }
  throw new Error(failures.join(" | "));
}

function deterministicReport(
  facts: { company: string; pe: number | null; roce: number | null; roe: number | null },
  market: ReturnType<typeof calculateMarket>,
  financials: ReturnType<typeof financialEvidence>,
  events: Array<{ tone: string }>,
  decision: ReturnType<typeof decisionEngine>,
  action: ReturnType<typeof actionView>,
): AiReport {
  const supportive = decision.models
      .filter((item) => item.signal === "Supportive")
      .map((item) => `${item.name}: ${item.plain}`),
    defensive = decision.models
      .filter((item) =>
        ["Defensive", "Extended", "Needs volume"].includes(item.signal),
      )
      .map((item) => `${item.name}: ${item.plain}`),
    negativeNews = events.filter((event) => event.tone === "Negative").length,
    verdict: AiReport["verdict"] =
      decision.agreement === "Strong agreement" && decision.risk !== "High"
        ? "Potentially investable"
        : decision.agreement === "Strong caution"
          ? "Avoid"
          : "Wait / watchlist";
  return {
    verdict,
    summary: `${facts.company} currently shows ${decision.agreement.toLowerCase()} with ${decision.risk.toLowerCase()} measured risk. ${action.rationale[0]}`,
    positives: supportive.slice(0, 3),
    risks: [
      ...defensive,
      ...(negativeNews
        ? [`${negativeNews} recent headline${negativeNews === 1 ? "" : "s"} were classified as negative context.`]
        : []),
    ].slice(0, 3),
    marketExpectations: `The historical setup map has a ${market.backtest.winRate.toFixed(1)}% positive-outcome rate and a ${market.backtest.medianReturn.toFixed(1)}% median ${market.backtest.horizonWeeks}-week return; this is descriptive, not predictive.`,
    assumptions: [
      "The sourced company snapshot and weekly price history are current enough for screening.",
      "Historical weekly setups remain useful as context, not as a forecast.",
    ],
    invalidation: action.conditions.slice(0, 3),
    nextChecks: [
      "Verify the latest exchange filing and reported results.",
      "Recheck trend, volume and valuation after the next material update.",
    ],
    financialRead: financials.available
      ? "The financial view uses available annual revenue, profit, cash-conversion and debt checks; verify the underlying filings before acting."
      : "Structured financial history is incomplete, so the business evidence cannot yet support a strong conclusion.",
    valuationRead:
      facts.pe === null
        ? "A usable P/E ratio was not available in the current snapshot."
        : `The current P/E snapshot is ${facts.pe.toFixed(1)}; compare it with verified growth and peer valuations before drawing a conclusion.`,
    governanceRead:
      "No primary governance or disclosure review was performed in this snapshot.",
    missingData: [
      "Latest primary exchange filings",
      "Independent governance review",
      ...(facts.roce === null || facts.roe === null
        ? ["Complete return-ratio data"]
        : []),
    ].slice(0, 5),
  };
}

export async function POST(request: Request) {
  let company: string | undefined;
  try {
    ({ company } = (await request.json()) as { company?: string });
  } catch {
    return NextResponse.json(
      { error: "Enter a company name or Screener/NSE code." },
      { status: 400 },
    );
  }
  if (!company?.trim())
    return NextResponse.json(
      { error: "Enter a company name or Screener/NSE code." },
      { status: 400 },
    );
  if (!process.env.NVIDIA_API_KEY)
    return NextResponse.json(
      { error: "NVIDIA analysis is not configured for this site." },
      { status: 503 },
    );
  const input = company.trim();
  try {
    const slug = await resolveCompanyCode(input);
    const response = await fetch(
      `https://www.screener.in/company/${encodeURIComponent(slug)}/consolidated/`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Vigilant research)",
        },
        next: { revalidate: 900 },
      },
    );
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            "Company not found. Try its NSE code, e.g. ASIANPAINT or RELIANCE.",
        },
        { status: 404 },
      );
    const html = await response.text();
    if (!html.includes("top-ratios"))
      return NextResponse.json(
        { error: "Company not found. Try its NSE code." },
        { status: 404 },
      );
    const companyId = /data-company-id="(\d+)"/.exec(html)?.[1];
    if (!companyId)
      return NextResponse.json(
        { error: "Historical price data is unavailable for this company." },
        { status: 502 },
      );
    const meta = description(html),
      facts = {
        company: strip(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? input),
        symbol: slug,
        asOf: new Date().toISOString(),
        source: "Screener.in company snapshot and chart data",
        price: ratio(html, "Current Price"),
        marketCap: ratio(html, "Market Cap"),
        pe: ratio(html, "Stock P/E"),
        priceToBook: null,
        roce: ratio(html, "ROCE"),
        roe: ratio(html, "ROE"),
        revenueCr: described(meta, "Revenue"),
        profitCr: described(meta, "Profit"),
        promoterHolding: described(meta, "Promoter Holding"),
        rawDescription: meta,
      };
    const [chartResponse, newsResponse, consensus] = await Promise.all([
      fetch(
        `https://www.screener.in/api/company/${companyId}/chart/?q=Price-DMA50-DMA200-Volume&days=1825&consolidated=true`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Vigilant research)",
          },
          next: { revalidate: 900 },
        },
      ),
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(`${facts.company} stock when:30d`)}&hl=en-IN&gl=IN&ceid=IN:en`,
        { next: { revalidate: 1800 } },
      ).catch(() => null),
      thirdPartyConsensus(slug),
    ]);
    if (!chartResponse.ok)
      throw new Error("Historical market data is temporarily unavailable.");
    const chart = (await chartResponse.json()) as {
        datasets?: Array<{ metric?: string; values?: Array<[string, string]> }>;
      },
      datasets = Object.fromEntries(
        (chart.datasets ?? []).map((dataset) => [
          dataset.metric,
          dataset.values ?? [],
        ]),
      );
    const volumes = new Map(
        (datasets.Volume ?? []).map(([date, value]) => [date, asNumber(value)]),
      ),
      history = (datasets.Price ?? [])
        .map(([date, value]) => ({
          date,
          close: asNumber(value),
          volume: volumes.get(date) ?? null,
        }))
        .filter(
          (point): point is Point =>
            typeof point.close === "number" && Number.isFinite(point.close),
        );
    if (history.length < 80)
      throw new Error(
        "Not enough weekly price history is available to calculate the research signals.",
      );
    const market = calculateMarket(history),
      events = newsResponse?.ok ? parseNews(await newsResponse.text()) : [],
      eventContext = {
        positive: events.filter((event) => event.tone === "Positive").length,
        negative: events.filter((event) => event.tone === "Negative").length,
        watch: events.filter((event) => event.tone === "Watch").length,
        summary: events.length
          ? `${events.filter((event) => event.tone === "Positive").length} positive, ${events.filter((event) => event.tone === "Negative").length} negative and ${events.filter((event) => event.tone === "Watch").length} watch headlines. Headline labels are automated context, not evidence of price causality.`
          : "No recent linked headlines were available.",
      },
      financials = financialEvidence(html),
      confidence = evidenceConfidence(
        facts,
        history,
        events.length,
        financials.available,
      ),
      decision = decisionEngine(market, financials, events.length);
    const action = actionView(facts, market, financials, consensus);
    const prompt = `You are a skeptical India equity-research analyst. Use only supplied facts, calculated indicators, structured statement data and dated headlines. Headlines are context, not proof or price causality. Never invent pledging, filings, peers, legal facts, or a price prediction. Return JSON only with {verdict,summary,positives,risks,marketExpectations,assumptions,invalidation,nextChecks,financialRead,valuationRead,governanceRead,missingData}. Verdict must be Potentially investable, Wait / watchlist, Avoid, or Insufficient evidence. positives and risks must each contain at most 3 short items. Do not assign a confidence score. Facts: ${JSON.stringify(facts)}. Financial evidence: ${JSON.stringify(financials)}. Deterministic weekly market signals: ${JSON.stringify(market.indicators)}. Similar-setup historical outcome map (descriptive, not predictive): ${JSON.stringify({ scenarios: market.scenarios, backtest: market.backtest })}. Deterministic action framework (research guidance only): ${JSON.stringify(action)}. External analyst consensus, if available: ${JSON.stringify(consensus)}. Event context: ${JSON.stringify(eventContext)}. Recent news headlines: ${JSON.stringify(events)}.`;
    let aiResult: {
      parsed: unknown;
      model: string;
      warnings: string[];
    };
    try {
      aiResult = await requestAnalysis(prompt);
    } catch {
      aiResult = {
        parsed: deterministicReport(
          facts,
          market,
          financials,
          events,
          decision,
          action,
        ),
        model: "vigilant/deterministic-research-v1",
        warnings: [
          "NVIDIA analysis was temporarily unavailable. Vigilant returned its evidence-based deterministic report instead; retry later for the AI narrative.",
        ],
      };
    }
    const priceAsOf = history.at(-1)?.date ?? null;
    return NextResponse.json({
      facts,
      market: { ...market, events, eventContext, decision, action },
      action,
      financials,
      report: normaliseReport(aiResult.parsed),
      confidence,
      sources: {
        companySnapshot: "Screener.in",
        priceHistory: {
          provider: "Screener.in",
          asOf: priceAsOf,
          points: history.length,
        },
        news: { provider: "Google News RSS", available: events.length > 0 },
        consensus: {
          provider: consensus.provider,
          available: consensus.available,
          asOf: consensus.asOf,
        },
        aiModel: aiResult.model,
        primaryFilingsReviewed: false,
      },
      warnings: [
        ...aiResult.warnings,
        ...(events.length
          ? []
          : [
              "Recent news could not be loaded; the research view excludes news context.",
            ]),
        ...(financials.available
          ? []
          : [
              "Structured financial history was incomplete; check company filings before relying on the financial view. ",
            ]),
        ...(consensus.available
          ? []
          : [
              "Third-party analyst consensus was not available for this NSE code.",
            ]),
      ],
      snapshotId: `${slug}:${priceAsOf ?? "unknown"}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed." },
      { status: 502 },
    );
  }
}
