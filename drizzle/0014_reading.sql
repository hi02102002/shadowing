CREATE TABLE `reading_passages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`paragraphs` text NOT NULL,
	`glossary` text NOT NULL,
	`questions` text NOT NULL,
	`answers` text,
	`score` integer,
	`answered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
