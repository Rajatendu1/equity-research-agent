ALTER TABLE `research_items` ADD `thesis_status` text DEFAULT 'Not reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `research_items` ADD `review_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `research_items` ADD `last_reviewed_at` text;