CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`feature` text NOT NULL,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`estimated` integer DEFAULT false NOT NULL,
	`ok` integer DEFAULT true NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_created_idx` ON `ai_usage` (`created_at`);