CREATE TABLE `grammar_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` text NOT NULL,
	`item_key` text NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_answers_unit_item_idx` ON `grammar_answers` (`unit_id`,`item_key`);--> statement-breakpoint
ALTER TABLE `mistakes` ADD `grammar_ref` text;