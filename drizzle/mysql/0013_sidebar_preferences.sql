CREATE TABLE `sidebar_preferences` (
	`user_id` varchar(36) NOT NULL,
	`sections` longtext NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sidebar_preferences_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `sidebar_preferences` ADD CONSTRAINT `sidebar_preferences_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;
