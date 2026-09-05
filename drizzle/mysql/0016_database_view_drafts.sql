CREATE TABLE `database_view_drafts` (
	`id` varchar(21) NOT NULL,
	`view_id` varchar(21) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`config` longtext,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `database_view_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `database_view_drafts_view_user_idx` UNIQUE(`view_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `database_view_drafts` ADD CONSTRAINT `database_view_drafts_view_id_database_views_id_fk` FOREIGN KEY (`view_id`) REFERENCES `database_views`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `database_view_drafts` ADD CONSTRAINT `database_view_drafts_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `database_view_drafts_user_id_idx` ON `database_view_drafts` (`user_id`);
