CREATE TABLE `research_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`symbol` text NOT NULL,
	`company` text NOT NULL,
	`thesis` text DEFAULT '' NOT NULL,
	`invalidation` text DEFAULT '' NOT NULL,
	`review_date` text,
	`status` text DEFAULT 'Watching' NOT NULL,
	`snapshot_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
