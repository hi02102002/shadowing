CREATE TABLE `reflex_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`position` integer NOT NULL,
	`prompt` text NOT NULL,
	`prompt_lang` text NOT NULL,
	`hint` text,
	`reference` text,
	`attribution` text,
	`transcript` text,
	`latency_ms` integer,
	`score` real,
	`feedback` text,
	`skipped` integer DEFAULT false NOT NULL,
	`answered_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `reflex_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reflex_items_session_idx` ON `reflex_items` (`session_id`);--> statement-breakpoint
CREATE TABLE `reflex_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`source` text NOT NULL,
	`level` text NOT NULL,
	`topic` text,
	`answer_seconds` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer
);
