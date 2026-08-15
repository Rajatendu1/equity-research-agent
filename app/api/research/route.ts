import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { researchItems } from "../../../db/schema";

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Unexpected error";
  if (value.includes("no such table")) return "Your research space is being prepared. Please try again shortly.";
  return value;
}

async function owner() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user.email.toLowerCase();
}

export async function GET() {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to view saved research." }, { status: 401 });
  try {
    const db = await getDb();
    const items = await db.select().from(researchItems).where(eq(researchItems.ownerEmail, email)).orderBy(desc(researchItems.updatedAt), desc(researchItems.id)).limit(50);
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to save research." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    if (!symbol || !company) return Response.json({ error: "Choose a company before saving research." }, { status: 400 });
    const values = { thesis: typeof body.thesis === "string" ? body.thesis.trim().slice(0, 1400) : "", invalidation: typeof body.invalidation === "string" ? body.invalidation.trim().slice(0, 900) : "", reviewDate: typeof body.reviewDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.reviewDate) ? body.reviewDate : null, decisionDate: typeof body.decisionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.decisionDate) ? body.decisionDate : null, referencePrice: typeof body.referencePrice === "number" && Number.isFinite(body.referencePrice) && body.referencePrice > 0 ? Math.round(body.referencePrice) : null, status: ["Watching", "Researching", "Own", "Avoid"].includes(String(body.status)) ? String(body.status) : "Watching", snapshotId: typeof body.snapshotId === "string" ? body.snapshotId.slice(0, 160) : "" };
    const db = await getDb();
    const item = (await db.insert(researchItems).values({ ownerEmail: email, symbol, company, ...values }).returning())[0];
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to review saved research." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "number" && Number.isInteger(body.id) ? body.id : null;
    if (!id) return Response.json({ error: "Choose a saved decision to review." }, { status: 400 });
    const thesisStatus = ["Held", "Weakened", "Broken", "Unclear"].includes(String(body.thesisStatus)) ? String(body.thesisStatus) : "Unclear";
    const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 1200) : "";
    const lastReviewedAt = new Date().toISOString();
    const db = await getDb();
    const item = (await db.update(researchItems).set({ thesisStatus, reviewNotes, lastReviewedAt, updatedAt: lastReviewedAt }).where(and(eq(researchItems.id, id), eq(researchItems.ownerEmail, email))).returning())[0];
    if (!item) return Response.json({ error: "Saved decision not found." }, { status: 404 });
    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to change saved research." }, { status: 401 });
  try {
    const body = await request.json() as { id?: number };
    if (!Number.isInteger(body.id)) return Response.json({ error: "Choose a saved item to remove." }, { status: 400 });
    const db = await getDb();
    await db.delete(researchItems).where(and(eq(researchItems.id, body.id!), eq(researchItems.ownerEmail, email)));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
