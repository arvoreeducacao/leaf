CREATE TABLE `form_webhooks` (
	`view_id` varchar(21) NOT NULL,
	`url` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `form_webhooks_view_id` PRIMARY KEY(`view_id`)
);
--> statement-breakpoint
ALTER TABLE `form_webhooks` ADD CONSTRAINT `form_webhooks_view_id_database_views_id_fk` FOREIGN KEY (`view_id`) REFERENCES `database_views`(`id`) ON DELETE cascade ON UPDATE no action;
