CREATE TABLE `dictation_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`segment_id` integer NOT NULL,
	`input` text NOT NULL,
	`score` real NOT NULL,
	`diff_json` text NOT NULL,
	`ai_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dictation_segment_idx` ON `dictation_attempts` (`segment_id`);--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`heard` text,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`segment_id` integer,
	`explanation` text,
	`tip` text,
	`ipa` text,
	`count` integer DEFAULT 1 NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_word_type_source_idx` ON `mistakes` (`word`,`type`,`source`);--> statement-breakpoint
CREATE TABLE `pronunciation_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`segment_id` integer NOT NULL,
	`mode` text NOT NULL,
	`transcript` text NOT NULL,
	`accuracy` real NOT NULL,
	`completeness` real NOT NULL,
	`wpm` real,
	`ref_wpm` real,
	`words_json` text NOT NULL,
	`ai_json` text,
	`audio_path` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pron_segment_idx` ON `pronunciation_attempts` (`segment_id`);--> statement-breakpoint
CREATE TABLE `segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`text` text NOT NULL,
	`words_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `segments_video_idx` ON `segments` (`video_id`,`idx`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`youtube_id` text NOT NULL,
	`title` text NOT NULL,
	`channel` text,
	`duration_sec` integer,
	`thumbnail` text,
	`caption_source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_youtube_id_idx` ON `videos` (`youtube_id`);