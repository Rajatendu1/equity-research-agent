import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const researchItems = sqliteTable("research_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  symbol: text("symbol").notNull(),
  company: text("company").notNull(),
  thesis: text("thesis").notNull().default(""),
  invalidation: text("invalidation").notNull().default(""),
  reviewDate: text("review_date"),
  status: text("status").notNull().default("Watching"),
  decisionDate: text("decision_date"),
  referencePrice: integer("reference_price"),
  thesisStatus: text("thesis_status").notNull().default("Not reviewed"),
  reviewNotes: text("review_notes").notNull().default(""),
  lastReviewedAt: text("last_reviewed_at"),
  snapshotId: text("snapshot_id").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const researchSnapshots = sqliteTable("research_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  researchItemId: integer("research_item_id").notNull(),
  snapshotId: text("snapshot_id").notNull(),
  capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  verdict: text("verdict").notNull().default(""),
  summary: text("summary").notNull().default(""),
  trend: text("trend").notNull().default(""),
  confidence: integer("confidence"),
  evidenceJson: text("evidence_json").notNull().default("{}"),
});
