CREATE TABLE `conversation_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`hints` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_turns_conv_idx` ON `conversation_turns` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scenario` text NOT NULL,
	`topic` text NOT NULL,
	`level` text NOT NULL,
	`feedback` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer
);
