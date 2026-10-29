ALTER TABLE `decks` ADD `book` text;--> statement-breakpoint
ALTER TABLE `decks` ADD `ref` text;--> statement-breakpoint
CREATE UNIQUE INDEX `decks_ref_idx` ON `decks` (`ref`);