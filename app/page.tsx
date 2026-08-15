"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./stabilization.css";
import "./financials.css";
import "./phase2.css";
import "./performance.css";
import "./calendar.css";
import "./scorecard.css";
import "./outcomes.css";
import "./enhancements.css";
import "./liquid-glass.css";

type Report = {
  verdict: string;
  summary: string;
  risks: string[];
  assumptions: string[];
  invalidation: string[];
  financialRead: string;
  valuationRead: string;
  governanceRead: string;
  missingData: string[];
  positives?: string[];
  marketExpectations?: string;
  nextChecks?: string[];
};
type Facts = {
  company?: string;
  symbol?: string;
  price?: number;
  pe?: number;
  marketCap?: number;
  roce?: number;
  roe?: number;
  asOf?: string;
  source?: string;
};
type Confidence = { score: number; available: string[]; limitations: string[] };
type Sources = {
  companySnapshot: string;
  priceHistory: { provider: string; asOf: string | null; points: number };
  news: { provider: string; available: boolean };
  consensus?: { provider: string; available: boolean; asOf: string | null };
  aiModel?: string;
  primaryFilingsReviewed: boolean;
};
type Signal = {
  name: string;
  direction: "Positive" | "Negative" | "Neutral";
  detail: string;
};
type Market = {
  last: number;
  history: Array<{ date: string; close: number; volume: number | null }>;
  indicators: {
    trend: string;
    trendScore: number;
    rsi: number;
    return4: number | null;
    return13: number | null;
    volatility: number | null;
    support: number;
    resistance: number;
    sma4: number | null;
    sma13: number | null;
    sma52: number | null;
    volumeRatio: number | null;
    volumeSignal: string;
    signals: Signal[];
  };
  scenarios: Array<{
    label: string;
    price: number;
    probability: number;
    reason: string;
  }>;
  backtest: {
    sampleSize: number;
    horizonWeeks: number;
    medianReturn: number;
    winRate: number;
    downsideRate: number;
    matchingRule: string;
  };
  events: Array<{
    title: string;
    link: string;
    date: string;
    category: string;
    tone: string;
  }>;
  eventContext: {
    positive: number;
    negative: number;
    watch: number;
    summary: string;
  };
  decision: {
    agreement: string;
    risk: string;
    models: Array<{
      name: string;
      signal: string;
      plain: string;
      method: string;
    }>;
    sourceHealth: { market: string; financials: string; events: string };
  };
  action: Action;
};
type Financials = {
  annual: Array<{
    period: string;
    revenue: number | null;
    operatingProfit: number | null;
    netProfit: number | null;
    borrowings: number | null;
    operatingCashFlow: number | null;
    capex: number | null;
  }>;
  metrics: {
    revenueGrowth: number | null;
    profitGrowth: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    revenueCagr: number | null;
    cashConversion: number | null;
    debtToOperatingProfit: number | null;
  };
  quarters: Array<{
    period: string;
    revenue: number | null;
    operatingProfit: number | null;
    netProfit: number | null;
  }>;
  available: boolean;
};
type Action = {
  stance: string;
  entryPrice: number;
  horizonWeeks: number;
  outcomes: Array<{
    label: string;
    price: number;
    probability: number;
    reason: string;
    returnPct: number | null;
    rupeeChange: number;
  }>;
  rationale: string[];
  conditions: string[];
  consensus: {
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
  comparison: string;
  disclaimer: string;
};
type Result = {
  facts: Facts;
  report: Report;
  market: Market;
  action: Action;
  financials: Financials;
  confidence: Confidence;
  sources: Sources;
  warnings?: string[];
  snapshotId: string;
};
const CACHE_PREFIX = "vigilant:research:v4:";
const number = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v)
    : "—";
const rupees = (v: unknown) => (typeof v === "number" ? `₹${number(v)}` : "—");
const list = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
const listText = (value: unknown, fallback: string) =>
  list(value).join(" · ") || fallback;
async function jsonFromResponse(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as { error?: string; [key: string]: unknown };
  } catch {
    const isHtml = /^\s*<!doctype html|^\s*<html/i.test(body);
    throw new Error(
      isHtml
        ? "The research service returned a web page instead of analysis data. Please refresh and try again; if it continues, the service is temporarily unavailable."
        : "The research service returned an unreadable response. Please try again shortly.",
    );
  }
}
const cacheKey = (company: string) =>
  `${CACHE_PREFIX}${company.trim().toLowerCase().replace(/\s+/g, "-")}`;

function DecisionSummary({
  market,
  confidence,
}: {
  market: Market;
  confidence: Confidence;
}) {
  const [open, setOpen] = useState(false),
    tone = market.decision.agreement.includes("caution")
      ? "caution"
      : market.decision.agreement.includes("constructive") ||
          market.decision.agreement.includes("Strong agreement")
        ? "constructive"
        : "mixed";
  return (
    <section className={`decision-summary decision-${tone}`}>
      <div className="decision-primary">
        <p className="kicker">Evidence agreement</p>
        <h3>{market.decision.agreement}</h3>
        <p>
          Signals are compared independently. Agreement is more useful than a
          single unexplained score.
        </p>
      </div>
      <div className="decision-stat">
        <small>Risk level</small>
        <b>{market.decision.risk}</b>
        <span>Price volatility + historical downside</span>
      </div>
      <div className="decision-stat">
        <small>Data coverage</small>
        <b>{confidence.score}/100</b>
        <span>How much reliable input is available</span>
      </div>
      <button
        type="button"
        className="decision-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Hide model checks" : "See why"}
        <span>{open ? "↑" : "↓"}</span>
      </button>
      {open && (
        <div className="decision-detail">
          <div className="model-grid">
            {market.decision.models.map((model) => (
              <article key={model.name}>
                <span
                  className={`model-${model.signal.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                >
                  {model.signal}
                </span>
                <h4>{model.name}</h4>
                <p>{model.plain}</p>
                <small>{model.method}</small>
              </article>
            ))}
          </div>
          <div className="source-health">
            <b>Input health</b>
            <span>Market data: {market.decision.sourceHealth.market}</span>
            <span>Financials: {market.decision.sourceHealth.financials}</span>
            <span>News context: {market.decision.sourceHealth.events}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function ResearchCompass({
  facts,
  financials,
  market,
  report,
  confidence,
}: {
  facts: Facts;
  financials: Financials;
  market: Market;
  report: Report;
  confidence: Confidence;
}) {
  const metrics = financials.metrics;
  const qualityScore = !financials.available
    ? null
    : [
        (metrics.revenueGrowth ?? -1) > 0,
        (metrics.profitGrowth ?? -1) > 0,
        (metrics.cashConversion ?? 0) >= 0.8,
        (metrics.debtToOperatingProfit ?? 99) < 3,
      ].filter(Boolean).length;
  const timingScore = [
    market.indicators.trendScore >= 2,
    market.backtest.medianReturn >= 0,
    market.indicators.rsi >= 38 && market.indicators.rsi <= 68,
  ].filter(Boolean).length;
  const valuationTone =
    report.valuationRead?.toLowerCase().includes("expensive") ||
    report.marketExpectations?.toLowerCase().includes("high")
      ? "Demanding"
      : report.valuationRead?.toLowerCase().includes("cheap") ||
          report.valuationRead?.toLowerCase().includes("reasonable")
        ? "Supportive"
        : "Needs context";
  const flags = [
    metrics.cashConversion !== null && metrics.cashConversion < 0.8
      ? "Profit is not converting cleanly into operating cash."
      : null,
    metrics.debtToOperatingProfit !== null && metrics.debtToOperatingProfit >= 3
      ? "Borrowings are high relative to operating profit."
      : null,
    metrics.operatingMargin !== null && metrics.operatingMargin < 0
      ? "Operating margin has deteriorated in the latest year."
      : null,
    market.indicators.trendScore <= -3
      ? "Price trend is weak; the setup has not repaired yet."
      : null,
    confidence.score < 60 ? "Evidence coverage is thin—verify primary filings." : null,
  ].filter((flag): flag is string => Boolean(flag));
  const nextCheck = report.nextChecks?.[0] ?? report.invalidation?.[0] ?? "Review the next results and any material company filing.";
  const qualityLabel = qualityScore === null ? "Partial" : qualityScore >= 3 ? "Resilient" : qualityScore >= 2 ? "Mixed" : "Fragile";
  const timingLabel = timingScore >= 3 ? "Constructive" : timingScore >= 2 ? "Forming" : "Unconvincing";
  return (
    <section className="research-compass" aria-label="Research compass">
      <div className="compass-intro">
        <p className="kicker">60-second decision cockpit</p>
        <h3>Do the three parts of the case agree?</h3>
        <p>Separate business quality, what the market already expects, and whether the price setup supports patience.</p>
      </div>
      <div className="compass-dials">
        <article className={`compass-dial ${qualityLabel.toLowerCase()}`}>
          <span className="dial-index">01</span><small>Business quality</small><b>{qualityLabel}</b>
          <i style={{ width: `${qualityScore === null ? 35 : (qualityScore / 4) * 100}%` }} />
          <p>{qualityScore === null ? "Annual statement data is incomplete." : `${qualityScore}/4 core tests passed`}</p>
        </article>
        <article className={`compass-dial ${valuationTone.toLowerCase().replace(/\s/g, "-")}`}>
          <span className="dial-index">02</span><small>Expectations</small><b>{valuationTone}</b>
          <i style={{ width: valuationTone === "Supportive" ? "72%" : valuationTone === "Demanding" ? "88%" : "48%" }} />
          <p>{facts.pe ? `P/E: ${facts.pe.toFixed(1)}×` : "Valuation data is limited"}</p>
        </article>
        <article className={`compass-dial ${timingLabel.toLowerCase()}`}>
          <span className="dial-index">03</span><small>Price timing</small><b>{timingLabel}</b>
          <i style={{ width: `${(timingScore / 3) * 100}%` }} />
          <p>{timingScore}/3 setup checks passed</p>
        </article>
      </div>
      <div className="compass-bottom">
        <div className="review-trigger"><span>Next review trigger</span><b>{nextCheck}</b></div>
        <div className={`flag-summary ${flags.length ? "has-flags" : "clear"}`}>
          <span>{flags.length ? `${flags.length} live watch ${flags.length === 1 ? "item" : "items"}` : "No mechanical red flags"}</span>
          {flags.length ? <p>{flags[0]}</p> : <p>Keep checking filings, cash flow and the next result.</p>}
        </div>
      </div>
    </section>
  );
}

function ResearchNotebook({ facts, report, snapshotId }: { facts: Facts; report: Report; snapshotId: string }) {
  const [open, setOpen] = useState(false), [thesis, setThesis] = useState(""), [invalidation, setInvalidation] = useState(report.invalidation?.[0] ?? ""), [reviewDate, setReviewDate] = useState(""), [decisionDate, setDecisionDate] = useState(new Date().toISOString().slice(0,10)), [referencePrice, setReferencePrice] = useState(facts.price ? String(Math.round(facts.price)) : ""), [status, setStatus] = useState("Watching"), [message, setMessage] = useState("");
  const save = async () => { setMessage("Saving your research…"); try { const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: facts.symbol, company: facts.company, thesis, invalidation, reviewDate, decisionDate, referencePrice:Number(referencePrice), status, snapshotId }) }), data = await jsonFromResponse(response); if (!response.ok) throw new Error(data.error ?? "Could not save your research."); setMessage("Saved to your private research space."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your research."); } };
  return <section className="research-notebook"><div><p className="kicker">Decision journal</p><h3>Record the decision, not just the thesis.</h3><p>Keep the original view, action and reference price so future reviews can test the process.</p></div><button className="notebook-toggle" type="button" onClick={()=>setOpen(!open)}>{open?"Close journal":"Save decision"}<span>{open?"↑":"↓"}</span></button>{open&&<div className="notebook-form"><label>Your thesis<textarea value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="Why might this company be worth tracking?" maxLength={1400}/></label><label>What would change your mind?<textarea value={invalidation} onChange={e=>setInvalidation(e.target.value)} placeholder="For example: margin falls, debt rises, or price breaks a key level." maxLength={900}/></label><div className="notebook-row"><label>Decision<select value={status} onChange={e=>setStatus(e.target.value)}><option>Watching</option><option>Researching</option><option>Own</option><option>Avoid</option></select></label><label>Decision date<input type="date" value={decisionDate} onChange={e=>setDecisionDate(e.target.value)}/></label><label>Reference price<input type="number" value={referencePrice} onChange={e=>setReferencePrice(e.target.value)} placeholder="₹ price" min="0"/></label><label>Review date<input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label></div><button className="notebook-save" type="button" onClick={save} disabled={!facts.symbol}>Save decision <span>→</span></button>{message&&<p className="notebook-message" role="status">{message}</p>}<p className="notebook-note">Saved research requires ChatGPT sign-in. It is separate from market data and does not create a trade instruction.</p></div>}</section>;
}

type SavedResearch = { id:number; symbol:string; company:string; thesis:string; invalidation:string; reviewDate:string|null; decisionDate:string|null; referencePrice:number|null; status:string; thesisStatus:string; reviewNotes:string; lastReviewedAt:string|null; updatedAt:string };
type EvidenceSnapshot = { capturedAt:string; verdict:string; summary:string; trend:string; evidenceJson?:string };
function ResearchShelf({ onResearch }: { onResearch: (company: string) => void }) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<SavedResearch[]>([]),[message,setMessage]=useState(""),[filter,setFilter]=useState<"All"|"Watchlist"|"Owned"|"Avoided">("All"),[quotes,setQuotes]=useState<Record<number,{price:number;asOf:string}>>({}),[freshness,setFreshness]=useState<Record<number,{verdict:string;trend:string;summary:string;checkedAt:string}>>({}),[diffs,setDiffs]=useState<Record<number,EvidenceSnapshot[]>>({}),[diffOpen,setDiffOpen]=useState<Record<number,boolean>>({}),[refreshing,setRefreshing]=useState(false),[scanning,setScanning]=useState(false);
  const load=async()=>{setOpen(true);setMessage("Loading your research…");try{const response=await fetch("/api/research"),data=await jsonFromResponse(response);if(!response.ok)throw new Error(data.error??"Could not load saved research.");const saved=(data.items as SavedResearch[])??[];setItems(saved);setMessage(saved.length?"":"No saved research yet.")}catch(error){setMessage(error instanceof Error?error.message:"Could not load saved research.")}};
  const remove=async(id:number)=>{if(!window.confirm("Remove this saved research item?"))return;const response=await fetch("/api/research",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});if(response.ok)setItems(current=>current.filter(item=>item.id!==id));else setMessage("Could not remove this item.")};
  const loadDiff=async(id:number)=>{const isOpen=diffOpen[id];setDiffOpen(current=>({...current,[id]:!isOpen}));if(isOpen||diffs[id])return;setMessage("Loading evidence history…");try{const response=await fetch(`/api/snapshots?itemId=${id}`),data=await jsonFromResponse(response);if(!response.ok)throw new Error(data.error??"Could not load the evidence history.");setDiffs(current=>({...current,[id]:(data.snapshots as EvidenceSnapshot[])??[]}));setMessage("");}catch(error){setMessage(error instanceof Error?error.message:"Could not load the evidence history.")}};
  const refreshQuotes=async()=>{if(!items.length)return;setRefreshing(true);setMessage("Refreshing available prices…");const results=await Promise.all(items.map(async item=>{try{const response=await fetch(`/api/quote?symbol=${encodeURIComponent(item.symbol)}`),data=await jsonFromResponse(response);return response.ok&&typeof data.price==="number"?[item.id,{price:data.price,asOf:typeof data.asOf==="string"?data.asOf:""}] as const:null}catch{return null}}));const next:Record<number,{price:number;asOf:string}>={};results.forEach(result=>{if(result)next[result[0]]=result[1]});setQuotes(next);setMessage(Object.keys(next).length?`Updated ${Object.keys(next).length} available ${Object.keys(next).length===1?"price":"prices"}.`:"Prices are unavailable right now. Try again later.");setRefreshing(false);void scanResearch()};
  const scanResearch=async()=>{if(!items.length)return;setScanning(true);setMessage("Comparing fresh research with your saved watchlist…");const results=await Promise.all(items.map(async item=>{try{const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company:item.symbol||item.company})});const data=await jsonFromResponse(response);if(!response.ok||!data.report||!data.market)return null;const report=data.report as {verdict?:string;summary?:string},market=data.market as {indicators?:{trend?:string};events?:Array<{title?:string;date?:string;category?:string;tone?:string}>},financials=data.financials as {metrics?:Record<string,number|null>}|undefined,confidence=data.confidence as {score?:number}|undefined;const snapshot={verdict:String(report.verdict??"Insufficient evidence"),trend:String(market.indicators?.trend??"Mixed trend"),summary:String(report.summary??"Fresh research available for review."),checkedAt:new Date().toISOString()},evidence={metrics:financials?.metrics??{},events:(market.events??[]).slice(0,4)};await fetch("/api/snapshots",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({researchItemId:item.id,snapshotId:`watchtower-${snapshot.checkedAt}`,verdict:snapshot.verdict,trend:snapshot.trend,summary:snapshot.summary,confidence:typeof confidence?.score==="number"?confidence.score:null,evidenceJson:JSON.stringify(evidence)})});return [item.id,snapshot] as const}catch{return null}}));const next:Record<number,{verdict:string;trend:string;summary:string;checkedAt:string}>={};results.forEach(result=>{if(result)next[result[0]]=result[1]});setFreshness(next);setDiffs({});setMessage(Object.keys(next).length?`Fresh scan complete for ${Object.keys(next).length} ${Object.keys(next).length===1?"company":"companies"} and saved as evidence history.`:"The fresh scan could not complete. Try again later.");setScanning(false)};
  const today=new Date();
  today.setHours(0,0,0,0);
  const due=items.filter(item=>item.reviewDate&&new Date(`${item.reviewDate}T00:00:00`)<=today).length;
  const soon=items.filter(item=>{if(!item.reviewDate)return false;const days=(new Date(`${item.reviewDate}T00:00:00`).getTime()-today.getTime())/86400000;return days>0&&days<=30}).length;
  const watchlist=items.filter(item=>["Watching","Researching"].includes(item.status)), owned=items.filter(item=>item.status==="Own"), visible=filter==="All"?items:filter==="Watchlist"?watchlist:filter==="Owned"?owned:items.filter(item=>item.status==="Avoid");
  const ownedMoves=owned.map(item=>{const quote=quotes[item.id];return quote&&item.referencePrice?((quote.price/item.referencePrice)-1)*100:null}).filter((move):move is number=>move!==null), ownedAverage=ownedMoves.length?ownedMoves.reduce((sum,move)=>sum+move,0)/ownedMoves.length:null, concentrationRisk=owned.length>=6?"Diversified watch":"Concentrated", returnLabel=ownedAverage===null?"Refresh needed":`${ownedAverage>=0?"+":""}${ownedAverage.toFixed(1)}% avg move`, reviewBurden=due>=3?"Heavy":due>0?"Active":"Clear";
  const reviewLabel=(item:SavedResearch)=>{if(!item.reviewDate)return "No review date";const days=Math.ceil((new Date(`${item.reviewDate}T00:00:00`).getTime()-today.getTime())/86400000);return days<0?`${Math.abs(days)}d overdue`:days===0?"Review today":days<=30?`Review in ${days}d`:"Review later"};
  const watchtower=items.map(item=>{const quote=quotes[item.id], fresh=freshness[item.id], move=quote&&item.referencePrice?((quote.price/item.referencePrice)-1)*100:null;const overdue=Boolean(item.reviewDate&&new Date(`${item.reviewDate}T00:00:00`)<=today);const state=item.thesisStatus&&item.thesisStatus!=="Not reviewed"?item.thesisStatus:"Thesis not reviewed";const freshRisk=fresh&&(fresh.verdict.includes("Avoid")||fresh.verdict.includes("Insufficient"));const severity=state==="Broken"||overdue||freshRisk?"high":state==="Weakened"||move!==null&&Math.abs(move)>=10||fresh&&fresh.verdict.includes("Wait")?"watch":"steady";const headline=state==="Broken"?"Thesis genuinely deteriorated":freshRisk?`Fresh scan: ${fresh.verdict}`:state==="Weakened"?"Thesis weakened":move!==null&&move<=-10?"Price fell; thesis needs checking":move!==null&&move>=10?"Price rose; valuation deserves a check":fresh?`Fresh scan: ${fresh.verdict}`:"No material thesis change recorded";return {item,move,state,severity,headline,overdue,fresh}}).sort((a,b)=>{const rank={high:0,watch:1,steady:2};return rank[a.severity]-rank[b.severity]});
  const calendarEvents=items.flatMap(item=>{const events:Array<{date:Date;kind:"Review"|"Result check";item:SavedResearch;note:string}>=[];if(item.reviewDate)events.push({date:new Date(`${item.reviewDate}T00:00:00`),kind:"Review",item,note:"Revisit the thesis and invalidation condition."});if(item.decisionDate){const started=new Date(`${item.decisionDate}T00:00:00`),next=new Date(started);while(next<=today)next.setDate(next.getDate()+91);events.push({date:next,kind:"Result check",item,note:"Estimated quarterly follow-up from the decision date."})}return events}).sort((a,b)=>a.date.getTime()-b.date.getTime()).slice(0,5);
  return <><button className="research-shelf-button" type="button" onClick={open?()=>setOpen(false):load}>{open?"Close Watchtower":"Watchtower"}</button>{open&&<section className="research-shelf" aria-label="Vigilant Watchtower"><div className="shelf-head"><div><p className="kicker">Private investing workspace</p><h2>Watchtower</h2><p>What changed, what matters, and which thesis deserves your attention next.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close Watchtower">×</button></div>{items.length>0&&<><section className="watchtower-brief"><div><p className="kicker">Change brief</p><h3>{watchtower.filter(change=>change.severity!=="steady").length?`${watchtower.filter(change=>change.severity!=="steady").length} companies need attention`:`No urgent thesis changes`}</h3><p>Price movement is not automatically a thesis change. Vigilant separates the two.</p></div><button type="button" onClick={refreshQuotes} disabled={refreshing||scanning}>{refreshing?"Refreshing…":scanning?"Scanning…":"Refresh evidence"}</button></section><section className="portfolio-radar" aria-label="Portfolio radar"><div><p className="kicker">Portfolio radar</p><h3>{owned.length?`${owned.length} owned ${owned.length===1?"idea":"ideas"}`:"No owned ideas yet"}</h3><p>Reference-price moves, review load and concentration from your saved decisions.</p></div><article><small>Owned return read</small><b className={ownedAverage!==null&&ownedAverage<0?"down":"up"}>{returnLabel}</b><span>{ownedMoves.length?`${ownedMoves.length} refreshed ${ownedMoves.length===1?"price":"prices"}`:"Use Refresh evidence"}</span></article><article><small>Concentration</small><b>{concentrationRisk}</b><span>{owned.length<6?"Add sizing later before calling this a portfolio.":"Owned list is broad enough for first-pass monitoring."}</span></article><article><small>Review burden</small><b>{reviewBurden}</b><span>{due?`${due} overdue or due today`:"No reviews due today"}</span></article></section><div className="watchtower-feed">{watchtower.slice(0,5).map(change=>{const history=diffs[change.item.id]??[],latest=history[0],previous=history[1],impact=change.item.invalidation.toLowerCase().includes("margin")||change.item.invalidation.toLowerCase().includes("debt")||change.item.invalidation.toLowerCase().includes("cash")?"Compare the fresh scan with your invalidation trigger.":change.item.invalidation?"No saved trigger has fired mechanically yet; verify the evidence before changing the thesis.":"Add an invalidation trigger so future scans can classify evidence.";return <article className={`watchtower-change ${change.severity}`} key={change.item.id}><div className="change-mark">{change.severity==="high"?"!":change.severity==="watch"?"~":"·"}</div><div><div className="change-meta"><span>{change.item.status}</span><small>{change.overdue?"Review overdue":"Monitoring"}</small></div><h3>{change.item.company} <small>· {change.item.symbol}</small></h3><b>{change.headline}</b><p>{change.item.invalidation?`Trigger: ${change.item.invalidation}`:"Add an invalidation condition to make this watch actionable."}</p>{change.fresh&&<p className="fresh-summary">{change.fresh.summary}</p>}</div><div className="change-actions"><button type="button" onClick={()=>{onResearch(change.item.symbol||change.item.company);setOpen(false)}}>Review</button><button type="button" onClick={()=>loadDiff(change.item.id)}>{diffOpen[change.item.id]?"Hide diff":"Evidence diff"}</button></div>{diffOpen[change.item.id]&&<div className="evidence-diff">{history.length<2?<p>Run refresh evidence twice to create a dated comparison.</p>:<><div className="diff-heading"><b>Previous to current</b><small>{new Date(previous.capturedAt).toLocaleDateString("en-IN")} to {new Date(latest.capturedAt).toLocaleDateString("en-IN")}</small></div><div className="diff-grid"><div><small>Research view</small><p>{previous.verdict||"Unscored"} <span>to</span> <b>{latest.verdict||"Unscored"}</b></p></div><div><small>Price trend</small><p>{previous.trend||"Mixed"} <span>to</span> <b>{latest.trend||"Mixed"}</b></p></div><div className="diff-summary"><small>Latest summary</small><p>{latest.summary}</p></div></div><p className="thesis-impact"><b>Thesis impact:</b> {impact}</p></>}</div>}</article>})}</div></>}{message&&<p className="shelf-message">{message}</p>}<div className="watchtower-stats timeline-summary workspace-summary"><div><b>{watchlist.length}</b><span>on watchlist</span></div><div><b>{owned.length}</b><span>owned ideas</span></div><div className={due?"needs-review":""}><b>{due}</b><span>need review</span></div><div><b>{soon}</b><span>due in 30 days</span></div></div><div className="workspace-tabs" role="tablist" aria-label="Research filters">{(["All","Watchlist","Owned","Avoided"] as const).map(tab=><button key={tab} type="button" role="tab" aria-selected={filter===tab} className={filter===tab?"active":""} onClick={()=>setFilter(tab)}>{tab}{tab==="Watchlist"?` ${watchlist.length}`:tab==="Owned"?` ${owned.length}`:""}</button>)}</div><div className="shelf-list">{visible.map(item=><article key={item.id}><div><div className="saved-card-head"><span className={`saved-status status-${item.status.toLowerCase()}`}>{item.status}</span><span className={item.reviewDate&&new Date(`${item.reviewDate}T00:00:00`)<=today?"review-pill urgent":"review-pill"}>{reviewLabel(item)}</span></div><h3>{item.company} <small>· {item.symbol}</small></h3>{item.thesis&&<p>{item.thesis}</p>}{item.invalidation&&<p className="saved-invalidation"><b>Change my mind:</b> {item.invalidation}</p>}</div><div className="saved-actions"><button className="research-again" type="button" onClick={()=>{onResearch(item.symbol||item.company);setOpen(false)}}>Research again</button><button className="saved-remove" type="button" onClick={()=>remove(item.id)}>Remove</button></div></article>)}</div>{items.length>0&&visible.length===0&&<p className="workspace-empty">No decisions in this view yet.</p>}<p className="workspace-note">Watchtower uses your saved thesis and review state. Refresh evidence before acting; this is a research workflow, not a trade instruction.</p></section>}</>;
}

function OutcomeReviews() {
  const [open,setOpen]=useState(false),[items,setItems]=useState<SavedResearch[]>([]),[selected,setSelected]=useState(""),[status,setStatus]=useState("Held"),[notes,setNotes]=useState(""),[message,setMessage]=useState("");
  const load=async()=>{setOpen(true);setMessage("Loading saved decisions…");try{const response=await fetch("/api/research"),data=await jsonFromResponse(response);if(!response.ok)throw new Error(data.error??"Could not load decisions.");const saved=(data.items as SavedResearch[])??[];setItems(saved);setSelected(saved[0]?String(saved[0].id):"");setMessage(saved.length?"":"Save a decision first, then return here to review it.")}catch(error){setMessage(error instanceof Error?error.message:"Could not load decisions.")}};
  const choose=(id:string)=>{setSelected(id);const item=items.find(value=>value.id===Number(id));setStatus(item?.thesisStatus&&item.thesisStatus!=="Not reviewed"?item.thesisStatus:"Held");setNotes(item?.reviewNotes??"")};
  const save=async()=>{if(!selected)return;setMessage("Saving outcome review…");try{const response=await fetch("/api/research",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(selected),thesisStatus:status,reviewNotes:notes})}),data=await jsonFromResponse(response);if(!response.ok)throw new Error(data.error??"Could not save review.");const updated=data.item as SavedResearch;setItems(current=>current.map(item=>item.id===updated.id?updated:item));setMessage("Review saved. Your original thesis remains unchanged.")}catch(error){setMessage(error instanceof Error?error.message:"Could not save review.")}};
  return <><button className="research-shelf-button" type="button" onClick={open?()=>setOpen(false):load}>{open?"Close outcomes":"Review outcomes"}</button>{open&&<section className="outcome-panel" aria-label="Decision outcome review"><div className="shelf-head"><div><p className="kicker">Decision outcome tracker</p><h2>Was the original thesis right?</h2><p>Record what changed without rewriting your initial reasoning.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close outcomes">×</button></div>{items.length>0&&<div className="outcome-form"><label>Saved decision<select value={selected} onChange={e=>choose(e.target.value)}>{items.map(item=><option value={item.id} key={item.id}>{item.company} · {item.status}</option>)}</select></label><label>Thesis status<select value={status} onChange={e=>setStatus(e.target.value)}><option>Held</option><option>Weakened</option><option>Broken</option><option>Unclear</option></select></label><label className="outcome-notes">What changed?<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1200} placeholder="New results, filing, risk, valuation change, or mistake in the original reasoning…"/></label><button type="button" onClick={save}>Save outcome review</button></div>}{message&&<p className="shelf-message" role="status">{message}</p>}{items.filter(item=>item.lastReviewedAt).slice(0,3).map(item=><article className="review-history" key={item.id}><span>{item.thesisStatus}</span><b>{item.company}</b><p>{item.reviewNotes||"No change note recorded."}</p><small>{new Date(item.lastReviewedAt!).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small></article>)}</section>}</>;
}

function ResearchCalendar(){
  const [open,setOpen]=useState(false),[items,setItems]=useState<SavedResearch[]>([]),[message,setMessage]=useState("");
  const load=async()=>{setOpen(true);setMessage("Loading your calendar…");try{const response=await fetch("/api/research"),data=await jsonFromResponse(response);if(!response.ok)throw new Error(data.error??"Could not load your calendar.");const saved=(data.items as SavedResearch[])??[];setItems(saved);setMessage(saved.length?"":"Save a decision with a review date to start your calendar.")}catch(error){setMessage(error instanceof Error?error.message:"Could not load your calendar.")}};
  const today=new Date();today.setHours(0,0,0,0);
  const events=items.flatMap(item=>{const output:Array<{date:Date;label:string;item:SavedResearch;detail:string}>=[];if(item.reviewDate)output.push({date:new Date(`${item.reviewDate}T00:00:00`),label:"Thesis review",item,detail:"Check what changed in the thesis, risks and invalidation."});if(item.decisionDate){const next=new Date(`${item.decisionDate}T00:00:00`);while(next<=today)next.setDate(next.getDate()+91);output.push({date:next,label:"Result follow-up",item,detail:"Estimated quarterly follow-up from the decision date."})}return output}).sort((a,b)=>a.date.getTime()-b.date.getTime()).slice(0,6);
  const dayLabel=(date:Date)=>{const days=Math.ceil((date.getTime()-today.getTime())/86400000);return days<0?`${Math.abs(days)}d overdue`:days===0?"Today":`In ${days}d`};
  return <><button className="research-shelf-button calendar-button" type="button" onClick={open?()=>setOpen(false):load}>{open?"Close calendar":"Review calendar"}</button>{open&&<section className="review-calendar" aria-label="Earnings and review calendar"><div className="calendar-head"><div><p className="kicker">Earnings & review calendar</p><h2>What deserves attention next</h2><p>Review dates are yours. Result follow-ups are estimated from the saved decision date.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close calendar">×</button></div>{message&&<p className="shelf-message">{message}</p>}<div className="calendar-track">{events.map(event=><article key={`${event.item.id}-${event.label}`}><time className={event.date<=today?"today":""}><b>{event.date.toLocaleDateString("en-IN",{day:"numeric"})}</b><span>{event.date.toLocaleDateString("en-IN",{month:"short"})}</span></time><div><span className={event.label==="Thesis review"?"calendar-kind review":"calendar-kind result"}>{event.label}</span><h3>{event.item.company} <small>· {event.item.symbol}</small></h3><p>{event.detail}</p></div><b className={event.date<=today?"calendar-due overdue":"calendar-due"}>{dayLabel(event.date)}</b></article>)}</div>{items.length>0&&!events.length&&<p className="workspace-empty">Add a decision date or review date to a saved thesis to populate the calendar.</p>}</section>}</>;
}

function ResearchScorecard({facts,financials,market,report}:{facts:Facts;financials:Financials;market:Market;report:Report}){
 const quality=Math.max(1,Math.min(5,Math.round(((facts.roce??10)/8)+(financials.metrics.revenueGrowth??0)/20))),valuation=facts.pe===undefined?3:facts.pe<25?4:facts.pe<50?3:2,momentum=market.indicators.trend==="Positive trend"?4:market.indicators.trend==="Weak trend"?2:3,debt=financials.metrics.debtToOperatingProfit===null?3:financials.metrics.debtToOperatingProfit<2?4:financials.metrics.debtToOperatingProfit<4?3:2,governance=report.governanceRead.toLowerCase().includes("concern")?2:3;
 const scores=[['Business quality',quality],['Valuation',valuation],['Price momentum',momentum],['Balance-sheet safety',debt],['Governance',governance]] as const;
 return <section className="research-scorecard"><div><p className="kicker">Research scorecard</p><h3>Five lenses. One quicker read.</h3><p>Signals summarise the available research; they are not a buy or sell score.</p></div><div className="scorecard-grid">{scores.map(([label,score])=><article key={label}><span>{label}</span><b>{score>=4?'Strong':score===3?'Mixed':'Weak'}</b><i>{[1,2,3,4,5].map(dot=><em key={dot} className={dot<=score?'filled':''}/>)}</i><small>{score}/5</small></article>)}</div></section>
}

function MarketChart({ market }: { market: Market }) {
  const [window, setWindow] = useState<4 | 26 | 52 | 260>(52),
    series = useMemo(
      () => market.history.slice(-Math.min(window, market.history.length)),
      [market.history, window],
    );
  const prices = series.map((point) => point.close),
    min = Math.min(...prices),
    max = Math.max(...prices),
    spread = Math.max(max - min, 1),
    path = series
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${(index / Math.max(series.length - 1, 1)) * 100} ${92 - ((point.close - min) / spread) * 82}`,
      )
      .join(" ");
  const trendClass =
    market.indicators.trend === "Positive trend"
      ? "positive"
      : market.indicators.trend === "Weak trend"
        ? "negative"
        : "mixed";
  return (
    <section className="market-card">
      <div className="market-head">
        <div>
          <p className="kicker">Price context & signals</p>
          <h3>{market.indicators.trend}</h3>
          <p>
            Weekly closing prices and systematic signals. They describe the
            setup; they do not forecast a price.
          </p>
        </div>
        <span className={`trend-chip ${trendClass}`}>
          {market.indicators.return4 === null
            ? "—"
            : `${market.indicators.return4 >= 0 ? "+" : ""}${market.indicators.return4.toFixed(1)}% · 1M`}
        </span>
      </div>
      <div className="range-tabs" aria-label="Chart period">
        {(
          [
            [4, "1M"],
            [26, "6M"],
            [52, "1Y"],
            [260, "5Y"],
          ] as const
        ).map(([weeks, label]) => (
          <button
            type="button"
            className={window === weeks ? "active" : ""}
            onClick={() => setWindow(weeks)}
            key={label}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="price-chart">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${window} week price history`}
        >
          <defs>
            <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#19865c" stopOpacity=".28" />
              <stop offset="1" stopColor="#19865c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L100 100 L0 100 Z`} fill="url(#priceFill)" />
          <path
            d={path}
            fill="none"
            stroke="#176b4e"
            strokeWidth="1.35"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="chart-high">₹{number(max)}</span>
        <span className="chart-low">₹{number(min)}</span>
        <span className="chart-last">₹{number(market.last)}</span>
      </div>
      <div className="signal-grid">
        <span>
          <b>RSI</b>
          {market.indicators.rsi.toFixed(0)}
          <small>14-week momentum</small>
        </span>
        <span>
          <b>Volatility</b>
          {market.indicators.volatility?.toFixed(0) ?? "—"}%
          <small>annualised</small>
        </span>
        <span>
          <b>Support</b>₹{number(market.indicators.support)}
          <small>13-week low</small>
        </span>
        <span>
          <b>Resistance</b>₹{number(market.indicators.resistance)}
          <small>13-week high</small>
        </span>
      </div>
      <p className="volume-context">
        <b>Volume · {market.indicators.volumeSignal}</b>
        {market.indicators.volumeRatio === null
          ? " Weekly volume was unavailable."
          : ` Recent activity is ${(market.indicators.volumeRatio * 100).toFixed(0)}% of its 13-week average.`}
      </p>
      <div className="scenario-data">
        <div>
          <p className="kicker">Three-month historical range map</p>
          <p>
            Outcome bands from prior, broadly similar weekly setups—not targets
            or odds.
          </p>
        </div>
        {market.scenarios.map((s) => (
          <div
            className={`scenario-value ${s.label.toLowerCase()}`}
            key={s.label}
          >
            <span>
              {s.label} · {s.probability}% of matched periods
            </span>
            <b>₹{number(s.price)}</b>
            <small>{s.reason}</small>
          </div>
        ))}
      </div>
      {market.events.length > 0 && (
        <div className="events">
          <p className="kicker">Recent news context</p>
          <p className="event-summary">{market.eventContext.summary}</p>
          {market.events.slice(0, 3).map((event) => (
            <a
              className={`event-${event.tone.toLowerCase()}`}
              href={event.link}
              target="_blank"
              rel="noreferrer"
              key={event.link}
            >
              <span>
                {event.category} ·{" "}
                {event.date
                  ? new Date(event.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Recent"}
              </span>
              {event.title}
              <b>↗</b>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
function pct(value: number | null, decimals = 0) {
  return value === null
    ? "—"
    : `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
function FinancialPanel({ financials }: { financials: Financials }) {
  if (!financials.available)
    return (
      <p className="warning">
        Structured financial history is unavailable for this company. Check the
        company’s filings directly.
      </p>
    );
  const metrics = financials.metrics;
  return (
    <section className="financial-panel">
      <div className="financial-head">
        <div>
          <p className="kicker">Financial evidence · ₹ crore</p>
          <h3>Five-year business record</h3>
          <p>
            Reported annual figures, used to test whether profit and cash are
            moving together.
          </p>
        </div>
        <span>Structured data</span>
      </div>
      <div className="financial-metrics">
        <div>
          <b>{pct(metrics.revenueCagr)}</b>
          <small>Revenue CAGR</small>
        </div>
        <div>
          <b>{pct(metrics.operatingMargin)}</b>
          <small>Operating margin</small>
        </div>
        <div>
          <b>{pct(metrics.netMargin)}</b>
          <small>Net margin</small>
        </div>
        <div>
          <b>
            {metrics.cashConversion === null
              ? "—"
              : `${metrics.cashConversion.toFixed(1)}×`}
          </b>
          <small>Cash / net profit</small>
        </div>
      </div>
      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>₹ crore</th>
              {financials.annual.map((row) => (
                <th key={row.period}>{row.period}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Revenue</th>
              {financials.annual.map((row) => (
                <td key={row.period}>{number(row.revenue)}</td>
              ))}
            </tr>
            <tr>
              <th>Operating profit</th>
              {financials.annual.map((row) => (
                <td key={row.period}>{number(row.operatingProfit)}</td>
              ))}
            </tr>
            <tr>
              <th>Net profit</th>
              {financials.annual.map((row) => (
                <td key={row.period}>{number(row.netProfit)}</td>
              ))}
            </tr>
            <tr>
              <th>Operating cash flow</th>
              {financials.annual.map((row) => (
                <td key={row.period}>{number(row.operatingCashFlow)}</td>
              ))}
            </tr>
            <tr>
              <th>Borrowings</th>
              {financials.annual.map((row) => (
                <td key={row.period}>{number(row.borrowings)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="finance-caption">
        Latest year: revenue {pct(metrics.revenueGrowth)} and net profit{" "}
        {pct(metrics.profitGrowth)} versus the prior year. Debt / operating
        profit:{" "}
        {metrics.debtToOperatingProfit === null
          ? "—"
          : `${metrics.debtToOperatingProfit.toFixed(1)}×`}
        .
      </p>
      {financials.quarters.length >= 2 && (
        <QuarterlyTracker quarters={financials.quarters} />
      )}
    </section>
  );
}
function QuarterlyTracker({ quarters }: { quarters: Financials["quarters"] }) {
  const latest = quarters.at(-1), prior = quarters.at(-2), yearAgo = quarters.at(-5);
  const change = (now: number | null | undefined, then: number | null | undefined) => now !== null && now !== undefined && then !== null && then !== undefined && then !== 0 ? ((now / then - 1) * 100) : null;
  const qoqRevenue = change(latest?.revenue, prior?.revenue), qoqProfit = change(latest?.netProfit, prior?.netProfit), yoyRevenue = change(latest?.revenue, yearAgo?.revenue);
  const read = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const improved = [qoqRevenue, qoqProfit].filter((value) => value !== null && value > 0).length;
  return <section className="quarterly-tracker">
    <div className="quarterly-head"><div><p className="kicker">Quarterly results tracker</p><h4>What changed in the latest result?</h4></div><span>{latest?.period ? new Date(`${latest.period}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Latest quarter"}</span></div>
    <div className="quarterly-cards"><article><small>Revenue vs prior quarter</small><b className={qoqRevenue !== null && qoqRevenue < 0 ? "down" : "up"}>{read(qoqRevenue)}</b><p>{qoqRevenue !== null && qoqRevenue >= 0 ? "Demand improved sequentially." : "Check whether demand softened."}</p></article><article><small>Net profit vs prior quarter</small><b className={qoqProfit !== null && qoqProfit < 0 ? "down" : "up"}>{read(qoqProfit)}</b><p>{qoqProfit !== null && qoqProfit >= 0 ? "Earnings improved sequentially." : "Check margins and one-off costs."}</p></article><article><small>Revenue vs last year</small><b className={yoyRevenue !== null && yoyRevenue < 0 ? "down" : "up"}>{read(yoyRevenue)}</b><p>{yearAgo ? "Year-on-year direction." : "Need five comparable quarters."}</p></article></div>
    <p className="quarterly-note">{improved >= 2 ? "The latest result improved on both core sequential checks." : improved === 1 ? "The latest result is mixed—read the earnings release before changing the thesis." : "The latest result did not improve on core sequential checks; verify whether the weakness is temporary."} Reported figures only; compare like-for-like periods before drawing a conclusion.</p>
  </section>;
}
function PeerComparison({ base }: { base: Result }) {
  const [peerOne, setPeerOne] = useState("Berger Paints"), [peerTwo, setPeerTwo] = useState("Kansai Nerolac"), [peers, setPeers] = useState<Result[]>([]), [loading, setLoading] = useState(false), [message, setMessage] = useState("");
  const runComparison = async () => {
    const names = [peerOne, peerTwo].map((name) => name.trim()).filter(Boolean).filter((name) => name.toLowerCase() !== (base.facts.company ?? "").toLowerCase());
    if (!names.length) { setMessage("Add at least one different company to compare."); return; }
    setLoading(true); setMessage("Comparing the same research checks across companies…");
    try {
      const reports = await Promise.all(names.map(async (company) => {
        const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company }) });
        const data = await jsonFromResponse(response); if (!response.ok) throw new Error(data.error ?? `Could not analyse ${company}.`); return data as Result;
      }));
      setPeers(reports); setMessage("Comparison ready. Each company uses the same current evidence checks.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not complete the comparison."); }
    finally { setLoading(false); }
  };
  const companies = [base, ...peers];
  const winner = (value: (item: Result) => number | null, higher = true) => {
    const values = companies.map(value).filter((item): item is number => item !== null); if (!values.length) return null; return higher ? Math.max(...values) : Math.min(...values);
  };
  const cell = (item: Result, value: number | null, best: number | null, suffix = "") => <td className={value !== null && best !== null && value === best ? "peer-best" : ""}>{value === null ? "—" : `${value.toFixed(1)}${suffix}`}</td>;
  return <section className="peer-comparison">
    <div className="peer-head"><div><p className="kicker">Peer comparison</p><h3>Is the company actually strong for its sector?</h3><p>Compare up to two NSE peers on identical current evidence—not a generic ranking.</p></div><span>Same research engine</span></div>
    <div className="peer-form"><label>Peer 1<input value={peerOne} onChange={(e) => setPeerOne(e.target.value)} placeholder="e.g. Berger Paints" /></label><label>Peer 2<input value={peerTwo} onChange={(e) => setPeerTwo(e.target.value)} placeholder="e.g. Kansai Nerolac" /></label><button type="button" onClick={runComparison} disabled={loading}>{loading ? "Comparing…" : "Compare peers"} <span>→</span></button></div>
    {loading && <div className="peer-loader" role="status" aria-live="polite"><div><b>Building the peer comparison</b><span>Resolving companies, gathering financial evidence and aligning the checks.</span></div><i /><small><em>Company data</em><em>Financial quality</em><em>Price context</em></small></div>}
    {message && <p className="peer-message" role="status">{message}</p>}
    {companies.length > 1 && <div className="peer-table-wrap"><table className="peer-table"><thead><tr><th>Current evidence</th>{companies.map((item) => <th key={item.facts.symbol}>{item.facts.company}<small>{item.facts.symbol}</small></th>)}</tr></thead><tbody><tr><th>Research view</th>{companies.map((item) => <td key={item.facts.symbol}><span className="peer-verdict">{item.report.verdict}</span></td>)}</tr><tr><th>Revenue growth</th>{companies.map((item) => cell(item, item.financials.metrics.revenueGrowth, winner((company) => company.financials.metrics.revenueGrowth), "%"))}</tr><tr><th>Net profit growth</th>{companies.map((item) => cell(item, item.financials.metrics.profitGrowth, winner((company) => company.financials.metrics.profitGrowth), "%"))}</tr><tr><th>Cash / net profit</th>{companies.map((item) => cell(item, item.financials.metrics.cashConversion, winner((company) => company.financials.metrics.cashConversion), "×"))}</tr><tr><th>Debt / operating profit</th>{companies.map((item) => cell(item, item.financials.metrics.debtToOperatingProfit, winner((company) => company.financials.metrics.debtToOperatingProfit, false), "×"))}</tr><tr><th>Trailing P/E</th>{companies.map((item) => cell(item, item.facts.pe ?? null, winner((company) => company.facts.pe ?? null, false), "×"))}</tr><tr><th>1-month price move</th>{companies.map((item) => cell(item, item.market.indicators.return4, winner((company) => company.market.indicators.return4), "%"))}</tr></tbody></table></div>}
    {companies.length > 1 && <p className="peer-note">Green numbers are the strongest relative value in this small peer set. A lower debt or P/E is treated as stronger; every other metric favours the higher value. Compare business models and accounting periods before deciding.</p>}
    {companies.length > 1 && <SectorBenchmark companies={companies} />}
  </section>;
}
function SectorBenchmark({ companies }: { companies: Result[] }) {
  const base = companies[0], rank = (get: (item: Result) => number | null) => { const value = get(base); const usable = companies.filter((item) => get(item) !== null).sort((a, b) => (get(b) ?? -Infinity) - (get(a) ?? -Infinity)); return value === null ? null : usable.findIndex((item) => item === base) + 1; };
  const ranks = [rank((item) => item.financials.metrics.revenueGrowth), rank((item) => item.facts.roce ?? null), rank((item) => item.market.indicators.return4)].filter((value): value is number => value !== null), average = ranks.length ? ranks.reduce((sum, value) => sum + value, 0) / ranks.length : null, label = average !== null && average <= 1.4 ? "Sector leader" : average !== null && average <= 2.2 ? "Middle of the selected set" : "Lagging the selected set";
  return <div className="sector-benchmark"><div><p className="kicker">Sector benchmark</p><h4>{label}</h4><p>Based on revenue growth, ROCE and 1-month price strength against the peers you selected.</p></div><div className="sector-ranks"><span><b>{rank((item) => item.financials.metrics.revenueGrowth) ?? "—"}</b>growth rank</span><span><b>{rank((item) => item.facts.roce ?? null) ?? "—"}</b>ROCE rank</span><span><b>{rank((item) => item.market.indicators.return4) ?? "—"}</b>price rank</span></div></div>;
}
function EvidenceTrail({ result }: { result: Result }) {
  const screener = `https://www.screener.in/company/${result.facts.symbol}/consolidated/`;
  const sources = [
    { label: "Company snapshot & reported financials", type: "Reported company data", href: screener, note: result.sources.companySnapshot },
    { label: "Price history & technical context", type: "Market data", href: screener, note: `${result.sources.priceHistory.points} observations through ${result.sources.priceHistory.asOf ?? "latest available date"}` },
    ...(result.market.events.slice(0, 2).map((event) => ({ label: event.title, type: "News context", href: event.link, note: event.date ? new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent" }))),
  ];
  return <section className="evidence-trail"><div className="evidence-head"><div><p className="kicker">Evidence trail</p><h3>See what supports the research view.</h3><p>Each item separates reported data from market context and headlines. News adds context; it does not prove a conclusion.</p></div><span>{result.sources.primaryFilingsReviewed ? "Primary filings reviewed" : "Primary filings not yet reviewed"}</span></div><div className="evidence-list">{sources.map((source) => <a href={source.href} target="_blank" rel="noreferrer" key={`${source.label}-${source.href}`}><span>{source.type}</span><b>{source.label}</b><small>{source.note}</small><i>↗</i></a>)}</div><p className="evidence-gap"><b>Important limitation:</b> This snapshot does not yet verify annual-report pages, investor presentations, or exchange filings. Treat that absence as a required next check, not as confirmation.</p></section>;
}
function FilingsGovernance({ result }: { result: Result }) {
  const metrics = result.financials.metrics, profile = `https://www.screener.in/company/${result.facts.symbol}/consolidated/`;
  const checks = [
    { name: "Cash quality", state: metrics.cashConversion === null ? "Needs filing review" : metrics.cashConversion >= .8 ? "No mechanical concern" : "Watch closely", text: metrics.cashConversion === null ? "Operating cash flow was not available in the reported snapshot." : `Cash from operations is ${metrics.cashConversion.toFixed(1)}× reported net profit.` },
    { name: "Balance-sheet pressure", state: metrics.debtToOperatingProfit === null ? "Needs filing review" : metrics.debtToOperatingProfit < 3 ? "No mechanical concern" : "Watch closely", text: metrics.debtToOperatingProfit === null ? "Debt context was incomplete." : `Borrowings are ${metrics.debtToOperatingProfit.toFixed(1)}× operating profit.` },
    { name: "Promoter / auditor review", state: "Not verified", text: "Promoter pledge, related-party dealings and auditor remarks require the latest annual report or exchange filing." },
    { name: "Management delivery", state: "Not verified", text: "Compare prior guidance with the next results release before treating the thesis as confirmed." },
  ];
  return <section className="filings-governance"><div className="filings-head"><div><p className="kicker">Filings & governance check</p><h3>What still needs primary-document verification?</h3><p>This is a disciplined review checklist, not a claim that governance has been cleared.</p></div><a href={profile} target="_blank" rel="noreferrer">Open reported statements ↗</a></div><div className="filings-grid">{checks.map((check) => <article key={check.name}><span className={check.state === "No mechanical concern" ? "check-clear" : "check-pending"}>{check.state}</span><h4>{check.name}</h4><p>{check.text}</p></article>)}</div><div className="filings-invalidation"><b>Thesis-update triggers</b><span>{result.report.invalidation?.slice(0, 2).join(" · ") || "Review the next results and any material disclosure."}</span></div></section>;
}
function SignalPanel({ market }: { market: Market }) {
  const backtest = market.backtest;
  return (
    <>
      <ActionPanel action={market.action} />
      <RecommendationCheck action={market.action} market={market} />
      <StrategyLab market={market} />
      <section className="signal-panel">
        <div className="signal-panel-head">
          <div>
            <p className="kicker">Signal check</p>
            <h3>What the price setup is saying</h3>
            <p>
              Four simple checks use the same weekly data shown above. They are
              explanatory signals, not trading instructions.
            </p>
          </div>
          <span
            className={
              market.indicators.trendScore >= 3
                ? "signal-positive"
                : market.indicators.trendScore <= -3
                  ? "signal-negative"
                  : "signal-neutral"
            }
          >
            {market.indicators.trend}
          </span>
        </div>
        <div className="signal-list">
          {market.indicators.signals.map((signal) => (
            <article
              key={signal.name}
              className={`signal-${signal.direction.toLowerCase()}`}
            >
              <span>{signal.direction}</span>
              <h4>{signal.name}</h4>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
        <div className="backtest">
          <div>
            <p className="kicker">Historical pattern check</p>
            <h4>{backtest.sampleSize} similar setups found</h4>
            <p>
              Looking forward {backtest.horizonWeeks} weeks, using{" "}
              {backtest.matchingRule.toLowerCase()}.
            </p>
          </div>
          <div>
            <b>
              {backtest.medianReturn >= 0 ? "+" : ""}
              {backtest.medianReturn.toFixed(1)}%
            </b>
            <small>median outcome</small>
          </div>
          <div>
            <b>{backtest.winRate}%</b>
            <small>finished higher</small>
          </div>
          <p className="backtest-note">
            This is a small, in-sample pattern comparison—not an independently
            validated forecast. The mix can change as new data arrives.
          </p>
        </div>
      </section>
    </>
  );
}
function ActionPanel({ action }: { action: Action }) {
  const kind = action.stance.includes("buy")
    ? "buy"
    : action.stance.includes("reducing")
      ? "reduce"
      : action.stance.includes("Hold")
        ? "hold"
        : "wait";
  return (
    <section className={`action-panel action-${kind}`}>
      <div className="action-head">
        <div>
          <p className="kicker">If you enter at today’s price</p>
          <h3>{action.stance}</h3>
          <p>
            Entry reference: <b>{rupees(action.entryPrice)}</b> ·{" "}
            {action.horizonWeeks}-week research window
          </p>
        </div>
        <span>Research guidance</span>
      </div>
      <div className="action-outcomes">
        {action.outcomes.map((outcome) => (
          <article key={outcome.label}>
            <span>{outcome.label} historical range</span>
            <b>{rupees(outcome.price)}</b>
            <small className={(outcome.returnPct ?? 0) >= 0 ? "up" : "down"}>
              {outcome.returnPct === null
                ? "—"
                : `${outcome.returnPct >= 0 ? "+" : ""}${outcome.returnPct.toFixed(1)}%`}{" "}
              · {outcome.rupeeChange >= 0 ? "+" : ""}
              {rupees(outcome.rupeeChange)}
            </small>
            <p>{outcome.reason}</p>
          </article>
        ))}
      </div>
      <div className="action-reason">
        <div>
          <p className="kicker">Why this stance</p>
          <ul>
            {action.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="kicker">What to watch next</p>
          <ul>
            {action.conditions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <details className="consensus">
        <summary>
          Compare with third-party analyst consensus <span>↓</span>
        </summary>
        {action.consensus.available ? (
          <div className="consensus-grid">
            <div>
              <small>External rating</small>
              <b>{action.consensus.rating ?? "Not published"}</b>
              <span>{action.consensus.analystCount ?? "—"} analysts</span>
            </div>
            <div>
              <small>Mean target</small>
              <b>{rupees(action.consensus.targetMean)}</b>
              <span>
                {action.consensus.targetLow !== null &&
                action.consensus.targetHigh !== null
                  ? `${rupees(action.consensus.targetLow)} – ${rupees(action.consensus.targetHigh)}`
                  : "Range not published"}
              </span>
            </div>
            <p>{action.comparison}</p>
            <a
              href={action.consensus.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View source on {action.consensus.provider} ↗
            </a>
          </div>
        ) : (
          <div className="consensus-empty">
            <p>{action.consensus.note}</p>
            <p>{action.comparison}</p>
            <a
              href={action.consensus.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Check {action.consensus.provider} ↗
            </a>
          </div>
        )}
      </details>
      <p className="action-disclaimer">{action.disclaimer}</p>
    </section>
  );
}
function RecommendationCheck({ action, market }: { action: Action; market: Market }) {
  const [recommendationDate, setRecommendationDate] = useState(""),
    [buyPrice, setBuyPrice] = useState(""),
    [sellPrice, setSellPrice] = useState(""),
    [sellDate, setSellDate] = useState(""),
    [checked, setChecked] = useState(false);
  const buy = Number(buyPrice),
    sell = Number(sellPrice),
    start = recommendationDate
      ? new Date(`${recommendationDate}T00:00:00`)
      : null,
    end = sellDate ? new Date(`${sellDate}T00:00:00`) : new Date(),
    days = start
      ? Math.max(0, (end.getTime() - start.getTime()) / 86400000)
      : null,
    returnPct = buy > 0 && sell > 0 ? (sell / buy - 1) * 100 : null,
    annualised =
      returnPct !== null && days !== null && days >= 30
        ? ((sell / buy) ** (365 / days) - 1) * 100
        : null;
  const expectedMove = market.indicators.volatility !== null && days !== null ? market.indicators.volatility * Math.sqrt(days / 365) : null,
    realism = returnPct === null || expectedMove === null ? "Needs more data" : Math.abs(returnPct) <= expectedMove * 1.25 ? "Within normal range" : Math.abs(returnPct) <= expectedMove * 2 ? "Ambitious" : "Very ambitious";
  const canCheck = Boolean(
      start && buy > 0 && sell > 0 && sellDate && days !== null && days > 0,
    ),
    verdict = !canCheck
      ? "Enter all four fields to run the comparison."
      : action.stance === "Consider reducing"
        ? "Do not proceed / consider reducing exposure"
        : action.stance === "Consider buying"
          ? "Research supports considering purchase"
          : action.stance.includes("Hold")
            ? "Hold / wait before adding"
            : "Wait for confirmation";
  const explanation =
    action.stance === "Consider reducing"
      ? "The recommendation’s historical return does not outweigh the current defensive trend and pattern evidence."
      : action.stance === "Consider buying"
        ? "The entry and current evidence are broadly constructive, but the historical outcome range still includes downside."
        : "The historical recommendation may have worked, but today’s evidence does not yet justify a fresh entry or addition.";
  return (
    <section className="recommendation-check">
      <div>
        <p className="kicker">Compare an app recommendation</p>
        <h3>Would Vigilant proceed with it today?</h3>
        <p>
          Enter the recommendation’s published prices and dates. Nothing is
          saved or shared.
        </p>
      </div>
      <div className="recommendation-form">
        <label>
          Recommendation date
          <input
            type="date"
            value={recommendationDate}
            onChange={(e) => {
              setRecommendationDate(e.target.value);
              setChecked(false);
            }}
          />
        </label>
        <label>
          Buy price (₹)
          <input
            inputMode="decimal"
            value={buyPrice}
            onChange={(e) => {
              setBuyPrice(e.target.value);
              setChecked(false);
            }}
            placeholder="0.00"
          />
        </label>
        <label>
          Sell price (₹)
          <input
            inputMode="decimal"
            value={sellPrice}
            onChange={(e) => {
              setSellPrice(e.target.value);
              setChecked(false);
            }}
            placeholder="0.00"
          />
        </label>
        <label>
          Sell date
          <input
            type="date"
            value={sellDate}
            onChange={(e) => {
              setSellDate(e.target.value);
              setChecked(false);
            }}
          />
        </label>
      </div>
      <button
        className="recommendation-button"
        type="button"
        disabled={!canCheck}
        onClick={() => setChecked(true)}
      >
        Compare with Vigilant research <span>→</span>
      </button>
      {checked && (
        <>
          <div className="recommendation-result">
            <div>
              <small>Total return</small>
              <b className={(returnPct ?? 0) >= 0 ? "up" : "down"}>
                {returnPct === null
                  ? "—"
                  : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%`}
              </b>
            </div>
            <div>
              <small>Annualised return</small>
              <b>
                {annualised === null
                  ? "—"
                  : `${annualised >= 0 ? "+" : ""}${annualised.toFixed(1)}%`}
              </b>
            </div>
            <div>
              <small>Time held</small>
              <b>{days === null ? "—" : `${Math.round(days)} days`}</b>
            </div>
            <div>
              <small>Target realism</small>
              <b>{realism}</b>
              <span>Compared with this stock’s historical volatility</span>
            </div>
          </div>
          <p className="recommendation-verdict">
            <b>{verdict}</b>
            {explanation} {expectedMove !== null && returnPct !== null ? `The stated move is ${Math.abs(returnPct).toFixed(1)}%; a typical volatility-based move over this period is about ${expectedMove.toFixed(1)}%.` : ""}
          </p>
        </>
      )}
      <p className="recommendation-note">
        Annualised return is shown only for periods of 30 days or more. Today’s
        reference price is {rupees(action.entryPrice)}; this comparison does not
        account for brokerage, tax or dividends.
      </p>
    </section>
  );
}
function StrategyLab({ market }: { market: Market }) {
  const [open, setOpen] = useState(false),
    central =
      market.scenarios.find((item) => item.label === "Central")?.price ??
      market.last,
    centralReturn = (central / market.last - 1) * 100,
    fast = market.indicators.sma4,
    medium = market.indicators.sma13,
    long = market.indicators.sma52;
  const trend =
    fast !== null &&
    medium !== null &&
    long !== null &&
    fast > medium &&
    market.last > long
      ? "Constructive"
      : fast !== null && medium !== null && fast < medium && market.last < long
        ? "Defensive"
        : "Mixed";
  const rsi = market.indicators.rsi,
    meanReversion =
      rsi < 35
        ? "Oversold watch"
        : rsi > 65
          ? "Extended / do not chase"
          : "Neutral";
  const breakout =
    market.last >= market.indicators.resistance * 0.985 &&
    market.indicators.volumeSignal === "Confirming"
      ? "Confirmed breakout"
      : market.last >= market.indicators.resistance * 0.985
        ? "Breakout needs volume"
        : "No breakout";
  const strategies = [
    {
      name: "Trend following",
      signal: trend,
      formula:
        "Buy/hold signal when Close > SMA(52) and SMA(4) > SMA(13). Defensive when both reverse.",
      interpretation: "Uses direction, not a price target.",
    },
    {
      name: "RSI mean reversion",
      signal: meanReversion,
      formula:
        "RSI(14) = 100 − 100 / (1 + average gains ÷ average losses). Watch below 35; avoid chasing above 65.",
      interpretation:
        "Works best in range-bound markets; it can fail in a strong trend.",
    },
    {
      name: "Breakout + volume",
      signal: breakout,
      formula:
        "Close is within 1.5% of the 13-week high and recent volume is above its 13-week average.",
      interpretation:
        "A confirmation filter, not proof that a breakout will persist.",
    },
    {
      name: "Similar-setup outcome",
      signal: `${market.backtest.winRate}% positive historically`,
      formula:
        "Match prior weeks by trend direction, RSI zone and volume regime; measure the next 13-week return.",
      interpretation: `Matched periods had a median outcome of ${market.backtest.medianReturn >= 0 ? "+" : ""}${market.backtest.medianReturn.toFixed(1)}%.`,
    },
  ];
  return (
    <section className="strategy-lab">
      <div className="strategy-head">
        <div>
          <p className="kicker">Strategy lab</p>
          <h3>Four transparent ways to read this setup</h3>
          <p>
            They produce signals and historical context—not guaranteed
            predictions.
          </p>
        </div>
        <span>
          {centralReturn >= 0 ? "+" : ""}
          {centralReturn.toFixed(1)}% central historical outcome
        </span>
      </div>
      <div className="strategy-grid">
        {strategies.map((strategy) => (
          <article key={strategy.name}>
            <span>{strategy.signal}</span>
            <h4>{strategy.name}</h4>
            <p>{strategy.interpretation}</p>
          </article>
        ))}
      </div>
      <button
        className="strategy-toggle"
        type="button"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide the formulas" : "See formulas & implement it yourself"}
        <span>{open ? "↑" : "↓"}</span>
      </button>
      {open && (
        <div className="strategy-formulas">
          {strategies.map((strategy, index) => (
            <article key={strategy.name}>
              <b>0{index + 1}</b>
              <div>
                <h4>{strategy.name}</h4>
                <code>{strategy.formula}</code>
                <p>{strategy.interpretation}</p>
              </div>
            </article>
          ))}
          <p className="strategy-caution">
            Inputs use the weekly closes and volumes already shown above. Test
            any strategy out-of-sample, include costs, and never treat a
            historical signal as certainty.
          </p>
        </div>
      )}
    </section>
  );
}

function ResearchPulse({ result }: { result: Result }) {
  const asOf = result.facts.asOf ? new Date(result.facts.asOf) : null,
    sourceCount = [
      Boolean(result.sources.companySnapshot),
      result.sources.priceHistory.points > 0,
      result.sources.news.available,
      Boolean(result.sources.consensus?.available),
    ].filter(Boolean).length,
    warningCount = result.warnings?.length ?? 0;
  return (
    <section className="research-pulse reveal-card" id="pulse" aria-label="Research freshness and coverage">
      <div className="pulse-intro">
        <span className="pulse-live"><i></i> Live research pulse</span>
        <h3>Know what this view is built on.</h3>
        <p>Freshness, source breadth and unresolved gaps—before the narrative.</p>
      </div>
      <div className="pulse-metrics">
        <article><small>Snapshot time</small><b>{asOf ? asOf.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Unknown"}</b><span>{asOf ? asOf.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "No timestamp"}</span></article>
        <article><small>Source breadth</small><b>{sourceCount}/4</b><span>market · financials · news · consensus</span></article>
        <article><small>Price history</small><b>{result.sources.priceHistory.points}</b><span>weekly observations</span></article>
        <article className={warningCount ? "pulse-watch" : "pulse-clear"}><small>Attention flags</small><b>{warningCount}</b><span>{warningCount ? "read before relying" : "no runtime warnings"}</span></article>
      </div>
    </section>
  );
}

function ScenarioLens({ result }: { result: Result }) {
  const current = result.action.entryPrice || result.market.last,
    prices = result.action.outcomes.map((item) => item.price),
    low = Math.max(1, Math.floor(Math.min(current, ...prices) * 0.92)),
    high = Math.max(low + 1, Math.ceil(Math.max(current, ...prices) * 1.08)),
    central = result.action.outcomes.find((item) => item.label === "Central")?.price ?? current,
    [target, setTarget] = useState(Math.round(central)),
    [buffer, setBuffer] = useState(8),
    returnPct = current > 0 ? (target / current - 1) * 100 : 0,
    support = result.market.indicators.support,
    riskReference = support * (1 - buffer / 100),
    reward = Math.max(0, target - current),
    risk = Math.max(0.01, current - riskReference),
    ratio = reward / risk,
    tone = returnPct >= 8 ? "constructive" : returnPct <= -5 ? "caution" : "balanced";
  return (
    <section className="scenario-lens reveal-card" id="scenarios">
      <div className="lens-head">
        <div><p className="kicker">Interactive scenario lens</p><h3>Stress-test the price, not your conviction.</h3><p>Move the target and risk buffer to see the implied maths. This does not predict where the share will trade.</p></div>
        <span className={`lens-tone ${tone}`}>{tone === "constructive" ? "Upside case" : tone === "caution" ? "Downside case" : "Near current"}</span>
      </div>
      <div className="lens-grid">
        <div className="lens-control">
          <div className="lens-readout"><span>Explore price</span><b>{rupees(target)}</b><em>{returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%</em></div>
          <input aria-label="Scenario price" type="range" min={low} max={high} value={target} onChange={(event) => setTarget(Number(event.target.value))} />
          <div className="range-labels"><span>{rupees(low)}</span><span>Current {rupees(current)}</span><span>{rupees(high)}</span></div>
          <div className="scenario-presets">
            {result.action.outcomes.map((item) => <button type="button" key={item.label} onClick={() => setTarget(Math.round(item.price))}><span>{item.label}</span><b>{rupees(item.price)}</b></button>)}
          </div>
        </div>
        <div className="risk-control">
          <div className="buffer-row"><span>Support buffer</span><b>{buffer}%</b></div>
          <input aria-label="Support buffer" type="range" min="3" max="20" value={buffer} onChange={(event) => setBuffer(Number(event.target.value))} />
          <div className="lens-stats">
            <article><small>Risk reference</small><b>{rupees(riskReference)}</b><span>{buffer}% below weekly support</span></article>
            <article><small>Upside / downside</small><b>{ratio.toFixed(1)}×</b><span>exploratory ratio</span></article>
            <article><small>Research horizon</small><b>{result.action.horizonWeeks}w</b><span>matches the outcome map</span></article>
          </div>
        </div>
      </div>
      <p className="lens-note">Scenario controls are educational research aids. They do not account for your portfolio, liquidity, tax, execution price or risk capacity.</p>
    </section>
  );
}

function ResearchToolbar({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  const copySnapshot = async () => {
    const summary = `${result.facts.company} (${result.facts.symbol}) — ${result.report.verdict}\n${result.report.summary}\nPrice: ${rupees(result.facts.price)} · Evidence: ${result.confidence.score}/100\nVigilant research, not investment advice.`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <nav className="research-toolbar" aria-label="Research sections">
      <div className="toolbar-links"><a href="#report">Snapshot</a><a href="#pulse">Sources</a><a href="#scenarios">Scenario lens</a><a href="#details">Deep research</a></div>
      <div className="toolbar-actions"><button type="button" onClick={copySnapshot}>{copied ? "Copied ✓" : "Copy snapshot"}</button><button type="button" onClick={() => window.print()}>Print</button></div>
    </nav>
  );
}

export default function Home() {
  const [company, setCompany] = useState("Asian Paints"),
    [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(false),
    [cacheNotice, setCacheNotice] = useState(""),
    [recentCompanies, setRecentCompanies] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setRecentCompanies(JSON.parse(sessionStorage.getItem("vigilant:recent-companies") ?? "[]") as string[]);
      } catch {
        setRecentCompanies([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function analyse(e: FormEvent, refresh = false) {
    e.preventDefault();
    const key = cacheKey(company);
    setError("");
    setExpanded(false);
    setCacheNotice("");
    if (!refresh) {
      try {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const cached = JSON.parse(saved) as {
            savedAt: number;
            result: Result;
          };
          if (Date.now() - cached.savedAt < 15 * 60 * 1000) {
            setResult(cached.result);
            setCacheNotice(
              "Showing this session’s saved snapshot. Refresh to fetch again.",
            );
            return;
          }
        }
      } catch {
        sessionStorage.removeItem(key);
      }
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company }),
        }),
        data = await jsonFromResponse(response);
      if (!response.ok) throw new Error(data.error ?? "Analysis is temporarily unavailable.");
      setResult(data as Result);
      const resolvedName = String((data.facts as Facts | undefined)?.symbol || company.trim()).toUpperCase(),
        nextRecent = [resolvedName, ...recentCompanies.filter((item) => item !== resolvedName)].slice(0, 5);
      setRecentCompanies(nextRecent);
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ savedAt: Date.now(), result: data }),
        );
        sessionStorage.setItem("vigilant:recent-companies", JSON.stringify(nextRecent));
      } catch {}
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }
  const report = result?.report,
    facts = result?.facts,
    positives = list(report?.positives).length
      ? list(report?.positives)
      : [
          report?.financialRead,
          report?.valuationRead,
          report?.governanceRead,
        ].filter((item): item is string => typeof item === "string"),
    risks = list(report?.risks);
  const roadmap = [
    { phase: "Shipped", title: "Research cockpit", copy: "Company resolution, live price context, financial history, verdicts, scenario ranges and an interactive research lens.", status: "Live", highlights: ["Research pulse", "Scenario lens", "Explainable signals"] },
    { phase: "Shipped", title: "Watchtower intelligence", copy: "A private watchlist that refreshes prices, scans the latest research view and separates price movement from thesis change.", status: "Live", highlights: ["Change brief", "Evidence refresh", "Thesis alerts"] },
    { phase: "Shipped", title: "Decision journal", copy: "Save the original thesis, invalidation trigger, decision, reference price and next review date for every idea.", status: "Live", highlights: ["Private notes", "Decision price", "Review trigger"] },
    { phase: "Shipped", title: "Review loop", copy: "Calendar-based follow-ups and outcome reviews turn a one-time stock call into a repeatable decision process.", status: "Live", highlights: ["Review calendar", "Outcome review", "Dated history"] },
    { phase: "Shipped", title: "Peer & sector lens", copy: "Compare companies on the same evidence engine, benchmark sector position and track the latest quarterly change.", status: "Live", highlights: ["Peer table", "Sector rank", "Quarter tracker"] },
    { phase: "Shipped", title: "Evidence & governance", copy: "Source-linked evidence, data-quality limits, mechanical red flags and a filing checklist make missing proof visible.", status: "Live", highlights: ["Evidence trail", "Red flags", "Governance checks"] },
    { phase: "Shipped", title: "Portfolio command centre", copy: "Owned ideas now roll up into a portfolio radar with refreshed return read, review burden and concentration prompts.", status: "Live", highlights: ["Owned radar", "Return read", "Review load"] },
    { phase: "In progress", title: "Evidence graph", copy: "Dated evidence snapshots and change diffs are live. Document-level links from each conclusion to its source are next.", status: "Building", highlights: ["Snapshots live", "Change diff live", "Source graph next"] },
  ];
  const liveRoadmapItems = roadmap.filter((item) => item.status === "Live").length;
  const roadmapCompletion = Math.round((liveRoadmapItems / roadmap.length) * 100);
  return (
    <main>
      <div className="liquid-backdrop" aria-hidden="true">
        <i className="liquid-orb liquid-orb-a" />
        <i className="liquid-orb liquid-orb-b" />
        <i className="liquid-orb liquid-orb-c" />
      </div>
      <header className="site-header">
        <a className="brand" href="#top">
          <span className="brand-mark">V</span>
          <span>Vigilant</span>
        </a>
        <div className="header-actions">
          <span className="header-note">India equity research · evidence first</span>
          <a className="header-link" href="#roadmap">Product map</a>
          <ResearchCalendar />
          <OutcomeReviews />
          <ResearchShelf onResearch={(query) => { setCompany(query); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">Simple research for complicated decisions</p>
          <h1>
            See the case.
            <br />
            See the risk.
          </h1>
          <p className="lede">
            Live company-specific price history, systematic signals, dated news
            context and a challenge-first research view.
          </p>
          <form className="search" onSubmit={(e) => analyse(e)}>
            <label className="sr-only" htmlFor="company">
              Company or NSE ticker
            </label>
            <input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Search company or NSE code"
            />
            <button disabled={loading}>
              {loading ? "Analysing…" : "Analyse"}
              <span>→</span>
            </button>
          </form>
          <div className="search-shortcuts" aria-label="Quick company searches">
            <span>{recentCompanies.length ? "Recent" : "Try"}</span>
            {(recentCompanies.length ? recentCompanies : ["CUPID", "RELIANCE", "INFY", "HDFCBANK"]).map((item) => (
              <button type="button" key={item} onClick={() => setCompany(item)}>{item}</button>
            ))}
          </div>
          {loading && (
            <div className="research-loader" role="status" aria-live="polite">
              <div className="loader-top">
                <span className="loader-orbit"></span>
                <div>
                  <b>Building {company.trim() || "your"} research view</b>
                  <small>
                    Collecting live evidence—this usually takes a few seconds.
                  </small>
                </div>
              </div>
              <div className="loader-track">
                <i></i>
              </div>
              <div className="loader-steps">
                <span>Market history</span>
                <span>Financial evidence</span>
                <span>News context</span>
                <span>Research synthesis</span>
              </div>
            </div>
          )}
          <p className="meta">
            Price history · financial evidence · source-linked news · research,
            not advice
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="welcome-card">
          <span className="mini-mark">01</span>
          <h2>One screen first.</h2>
          <p>
            Verdict, evidence quality, price trend, range map and events that
            may matter—without a cluttered trading terminal.
          </p>
          <div className="welcome-list">
            <span>Company-specific charts</span>
            <span>Explainable signals</span>
            <span>Financial evidence</span>
          </div>
          <div className="welcome-command"><span>⌘ K</span> Jump to a company, notebook, or signal</div>
        </aside>
      </section>
      <section className="cockpit-strip" aria-label="Vigilant workflow">
        <div><span>01</span><b>Find the signal</b><small>Search any India-listed company</small></div>
        <div><span>02</span><b>Challenge the story</b><small>See assumptions, risks, and missing evidence</small></div>
        <div><span>03</span><b>Keep the thread</b><small>Review decisions as new information arrives</small></div>
      </section>
      {result && report && (
        <section className="result" id="report">
          <div className="result-top">
            <div>
              <p className="kicker">Research snapshot</p>
              <h2>
                {facts.company} <span>· {facts.symbol}</span>
              </h2>
              <p className="data-note">
                Data snapshot:{" "}
                {facts.asOf
                  ? new Date(facts.asOf).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "today"}{" "}
                · {facts.source ?? "reported sources"}
              </p>
            </div>
            <div className="price-box">
              <span>Current price</span>
              <b>{rupees(facts.price)}</b>
            </div>
          </div>
          {cacheNotice && (
            <p className="cache-note">
              {cacheNotice}{" "}
              <button
                type="button"
                onClick={(e) => analyse(e as unknown as FormEvent, true)}
              >
                Refresh data
              </button>
            </p>
          )}
          <ResearchToolbar result={result} />
          <div className="verdict-strip">
            <div>
              <span className="label">Research view</span>
              <h3>{report.verdict}</h3>
            </div>
            <div className="confidence-meter">
              <span>Evidence coverage</span>
              <div>
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, result.confidence.score))}%`,
                  }}
                ></i>
              </div>
              <b>{result.confidence.score}/100</b>
            </div>
            <p>{report.summary}</p>
          </div>
          <DecisionSummary market={result.market} confidence={result.confidence} />
          <ResearchCompass
            facts={facts}
            financials={result.financials}
            market={result.market}
            report={report}
            confidence={result.confidence}
          />
          <ResearchScorecard facts={facts} financials={result.financials} market={result.market} report={report} />
          <ResearchPulse result={result} />
          <ScenarioLens result={result} />
          <MarketChart market={result.market} />
          <div className="quick-grid">
            <article className="reason-card">
              <p className="kicker">Why this view</p>
              <ol>
                {positives.slice(0, 3).map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <span>0{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </article>
            <article className="risk-card">
              <p className="kicker">Watch these risks</p>
              <ul>
                {risks.slice(0, 3).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
              <p className="market-note">
                <b>Market expectations</b>
                {report.marketExpectations ?? report.valuationRead}
              </p>
            </article>
          </div>
          <div className="metric-row">
            <span>
              Trailing P/E <b>{number(facts.pe)}</b>
            </span>
            <span>
              Market cap <b>{rupees(facts.marketCap)} Cr</b>
            </span>
            <span>
              ROCE <b>{number(facts.roce)}%</b>
            </span>
            <span>
              ROE <b>{number(facts.roe)}%</b>
            </span>
          </div>
          <button
            className="details-button"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded
              ? "Hide detailed research"
              : "See the evidence, assumptions & checks"}
            <span>{expanded ? "↑" : "↓"}</span>
          </button>
          {expanded && (
            <section className="details" id="details">
              <SignalPanel market={result.market} />
              <ResearchNotebook facts={facts} report={report} snapshotId={result.snapshotId} />
              <FinancialPanel financials={result.financials} />
              <PeerComparison base={result} />
              <EvidenceTrail result={result} />
              <FilingsGovernance result={result} />
              <div className="detail-intro">
                <p className="kicker">Detailed research</p>
                <h3>Understand the call without losing the thread.</h3>
                <p>
                  These checks are shown only when you choose to go deeper.
                  Missing primary evidence is a finding, not a hidden gap.
                </p>
              </div>
              <div className="detail-grid">
                <article>
                  <h4>Financial health</h4>
                  <p>{report.financialRead}</p>
                </article>
                <article>
                  <h4>Valuation & expectations</h4>
                  <p>{report.valuationRead}</p>
                </article>
                <article>
                  <h4>Governance & accounting</h4>
                  <p>{report.governanceRead}</p>
                </article>
                <article>
                  <h4>Evidence available</h4>
                  <p>
                    {listText(
                      result.confidence.available,
                      "No reliable source summary available.",
                    )}
                  </p>
                </article>
                <article>
                  <h4>Evidence still needed</h4>
                  <p>
                    {listText(
                      [...result.confidence.limitations, ...report.missingData],
                      "No missing-data flags provided.",
                    )}
                  </p>
                </article>
                <article>
                  <h4>What would change the view</h4>
                  <p>
                    {listText(
                      report.invalidation,
                      "No invalidation conditions provided.",
                    )}
                  </p>
                </article>
              </div>
              <p className="source-note">
                Sources: {result.sources.companySnapshot} snapshot;{" "}
                {result.sources.priceHistory.points} weekly price observations
                through{" "}
                {result.sources.priceHistory.asOf ?? "an unavailable date"};{" "}
                {result.sources.news.available
                  ? "linked news headlines"
                  : "no news context"}
                ; analysis {result.sources.aiModel ?? "model unavailable"}.
                Primary filings reviewed:{" "}
                {result.sources.primaryFilingsReviewed ? "yes" : "no"}.
              </p>
              {result.warnings?.map((warning) => (
                <p className="warning" key={warning}>
                  {warning}
                </p>
              ))}
            </section>
          )}
        </section>
      )}
      <section className="method">
        <p className="kicker">How Vigilant thinks</p>
        <h2>It challenges the story before trusting it.</h2>
        <div>
          <span>Build the thesis</span>
          <i>→</i>
          <span>Test the assumptions</span>
          <i>→</i>
          <span>Show what is missing</span>
        </div>
      </section>
      <section className="roadmap" id="roadmap">
        <div className="roadmap-head"><div><p className="kicker">The Vigilant product map</p><h2>Most of the research loop is already live.</h2></div><p>Our north star is a research loop you can trust: discover → challenge → decide → review. This map now reflects what is actually usable today—and what still needs to be built.</p></div>
        <div className="roadmap-progress" aria-label={`${roadmapCompletion}% of roadmap capabilities live`}>
          <div><span>Product progress</span><b>{liveRoadmapItems} of {roadmap.length} capabilities live</b></div>
          <strong>{roadmapCompletion}%</strong>
          <div className="roadmap-progress-track"><i style={{ width: `${roadmapCompletion}%` }} /></div>
        </div>
        <div className="roadmap-grid">{roadmap.map((item, i) => <article className={`roadmap-card roadmap-${item.status.toLowerCase()}`} key={item.title}><div><span className="roadmap-index">{String(i + 1).padStart(2, "0")}</span><span className="roadmap-status">{item.status}</span></div><small>{item.phase}</small><h3>{item.title}</h3><p>{item.copy}</p><div className="roadmap-highlights">{item.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div></article>)}</div>
      </section>
      <footer>
        <p>Vigilant supports research, not personalised investment decisions. Verify filings, current prices and personal suitability before acting.</p>
        <a className="feedback-link" href="mailto:rajatendud@gmail.com?subject=Vigilant%20feedback">Share feedback or report an issue <span>→</span></a>
      </footer>
    </main>
  );
}
