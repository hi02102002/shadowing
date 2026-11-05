CREATE TABLE `roadmaps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`goal` text NOT NULL,
	`current_level` text NOT NULL,
	`target_level` text NOT NULL,
	`duration_months` integer NOT NULL,
	`total_weeks` integer NOT NULL,
	`daily_minutes` integer NOT NULL,
	`focus_skills` text NOT NULL,
	`summary` text NOT NULL,
	`phases` text NOT NULL,
	`weeks` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roadmap_id` integer NOT NULL,
	`week_number` integer NOT NULL,
	`day_number` integer NOT NULL,
	`day_title` text NOT NULL,
	`position` integer NOT NULL,
	`activity_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`level` text NOT NULL,
	`topic` text,
	`search_query` text,
	`preferred_source` text,
	`video` text,
	`resource` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roadmap_tasks_roadmap_week_idx` ON `roadmap_tasks` (`roadmap_id`,`week_number`,`day_number`);
