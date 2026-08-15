CREATE TABLE `research_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`research_item_id` integer NOT NULL,
	`snapshot_id` text NOT NULL,
	`captured_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`verdict` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`trend` text DEFAULT '' NOT NULL,
	`confidence` integer
);
