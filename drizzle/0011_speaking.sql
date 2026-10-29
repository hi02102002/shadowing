CREATE TABLE `speaking_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`bullets` text NOT NULL,
	`transcript` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`feedback` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
