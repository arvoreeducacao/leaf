CREATE TABLE `notion_connections` (
	`user_id` varchar(36) NOT NULL,
	`access_token` text NOT NULL,
	`workspace_id` varchar(64),
	`workspace_name` varchar(255),
	`bot_id` varchar(64),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notion_connections_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `notion_connections` ADD CONSTRAINT `notion_connections_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;