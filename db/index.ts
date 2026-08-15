import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS research_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner_email TEXT NOT NULL,
    symbol TEXT NOT NULL,
    company TEXT NOT NULL,
    thesis TEXT NOT NULL DEFAULT '',
    invalidation TEXT NOT NULL DEFAULT '',
    review_date TEXT,
    status TEXT NOT NULL DEFAULT 'Watching',
    snapshot_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS research_items_owner_updated_idx ON research_items(owner_email, updated_at)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS research_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner_email TEXT NOT NULL,
    research_item_id INTEGER NOT NULL,
    snapshot_id TEXT NOT NULL,
    captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verdict TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    trend TEXT NOT NULL DEFAULT '',
    confidence INTEGER,
    evidence_json TEXT NOT NULL DEFAULT '{}'
  )`).run();
  await env.DB.prepare("ALTER TABLE research_snapshots ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '{}' ").run().catch(() => {});
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS research_snapshots_item_time_idx ON research_snapshots(owner_email, research_item_id, captured_at)").run();

  return drizzle(env.DB, { schema });
}
