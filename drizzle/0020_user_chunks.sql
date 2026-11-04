CREATE TABLE `user_chunk_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`file_name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`done_pages` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`meaning_vi` text,
	`example_en` text,
	`kind` text NOT NULL,
	`page` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `user_chunk_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_chunks_import_text_idx` ON `user_chunks` (`import_id`,`normalized_text`);--> statement-breakpoint
CREATE INDEX `user_chunks_text_idx` ON `user_chunks` (`normalized_text`);