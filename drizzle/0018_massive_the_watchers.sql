CREATE TABLE `listening_passages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`level` text NOT NULL,
	`topic` text NOT NULL,
	`format` text DEFAULT 'standard' NOT NULL,
	`sections` text NOT NULL,
	`answers` text,
	`score` integer,
	`answered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
