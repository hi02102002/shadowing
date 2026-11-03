ALTER TABLE `reading_passages` ADD `source` text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_passages` ADD `source_url` text;