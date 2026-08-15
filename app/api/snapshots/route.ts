import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { researchSnapshots } from "../../../db/schema";

const owner = async () => (await getChatGPTUser())?.email.toLowerCase() ?? null;
const clean = (value: unknown, max = 700) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export async function GET(request: Request) {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to view research history." }, { status: 401 });
  const itemId = Number(new URL(request.url).searchParams.get("itemId"));
  if (!Number.isInteger(itemId)) return Response.json({ error: "Choose a saved research item." }, { status: 400 });
  try {
    const db = await getDb();
    const snapshots = await db.select().from(researchSnapshots).where(and(eq(researchSnapshots.ownerEmail, email), eq(researchSnapshots.researchItemId, itemId))).orderBy(desc(researchSnapshots.capturedAt)).limit(12);
    return Response.json({ snapshots });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load research history." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const email = await owner();
  if (!email) return Response.json({ error: "Sign in with ChatGPT to save research history." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const researchItemId = Number(body.researchItemId);
    if (!Number.isInteger(researchItemId)) return Response.json({ error: "Choose a saved research item." }, { status: 400 });
    const db = await getDb();
    const previous = (await db.select().from(researchSnapshots).where(and(eq(researchSnapshots.ownerEmail, email), eq(researchSnapshots.researchItemId, researchItemId))).orderBy(desc(researchSnapshots.capturedAt)).limit(1))[0];
    const current = { verdict: clean(body.verdict, 120), summary: clean(body.summary), trend: clean(body.trend, 120), confidence: typeof body.confidence === "number" ? Math.round(body.confidence) : null, evidenceJson: clean(body.evidenceJson, 5000) || "{}" };
    const snapshot = (await db.insert(researchSnapshots).values({ ownerEmail: email, researchItemId, snapshotId: clean(body.snapshotId, 160) || crypto.randomUUID(), ...current }).returning())[0];
    const changes = [
      previous && previous.verdict !== current.verdict ? "Research view changed" : null,
      previous && previous.trend !== current.trend ? "Price trend changed" : null,
      previous && previous.summary !== current.summary ? "Summary changed" : null,
      previous && previous.evidenceJson !== current.evidenceJson ? "Financial or event evidence changed" : null,
    ].filter(Boolean);
    return Response.json({ snapshot, previous: previous ?? null, changes });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not save research history." }, { status: 500 }); }
}
