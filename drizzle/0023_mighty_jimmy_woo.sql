CREATE TABLE `segment_edit_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `segment_edit_revision_idx` ON `segment_edit_revisions` (`video_id`,`revision`);--> statement-breakpoint
CREATE TABLE `segment_edit_states` (
	`video_id` integer PRIMARY KEY NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
