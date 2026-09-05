ALTER TABLE `form_webhooks` MODIFY COLUMN `url` varchar(500);--> statement-breakpoint
ALTER TABLE `form_webhooks` ADD `channel_id` varchar(32);--> statement-breakpoint
ALTER TABLE `form_webhooks` ADD `channel_name` varchar(120);--> statement-breakpoint
ALTER TABLE `form_webhooks` ADD `pull_thread` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `form_webhooks` ADD `push_comments` boolean NOT NULL DEFAULT true;--> statement-breakpoint
CREATE TABLE `slack_threads` (
	`document_id` varchar(21) NOT NULL,
	`view_id` varchar(21),
	`channel_id` varchar(32) NOT NULL,
	`message_ts` varchar(32) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `slack_threads_document_id` PRIMARY KEY(`document_id`),
	CONSTRAINT `slack_threads_channel_message_ts_idx` UNIQUE(`channel_id`,`message_ts`)
);
--> statement-breakpoint
ALTER TABLE `slack_threads` ADD CONSTRAINT `slack_threads_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `slack_threads` ADD CONSTRAINT `slack_threads_view_id_database_views_id_fk` FOREIGN KEY (`view_id`) REFERENCES `database_views`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD `origin` enum('leaf','slack') DEFAULT 'leaf' NOT NULL;--> statement-breakpoint
ALTER TABLE `comments` ADD `external_id` varchar(64);--> statement-breakpoint
ALTER TABLE `comments` ADD `external_author_id` varchar(32);--> statement-breakpoint
ALTER TABLE `comments` ADD `external_author_name` varchar(255);--> statement-breakpoint
ALTER TABLE `comments` ADD `external_author_image` varchar(1024);--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_document_id_external_id_idx` UNIQUE(`document_id`,`external_id`);
