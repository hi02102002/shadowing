CREATE TABLE `lookups` (
	`key` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
