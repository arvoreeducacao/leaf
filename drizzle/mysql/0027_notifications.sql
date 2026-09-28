CREATE TABLE `notifications` (
	`id` varchar(21) NOT NULL,
	`recipient_id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`document_id` varchar(21) NOT NULL,
	`kind` enum('mention') NOT NULL DEFAULT 'mention',
	`source_key` varchar(64) NOT NULL,
	`read_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_recipient_document_source_idx` UNIQUE(`recipient_id`,`document_id`,`source_key`)
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_at_idx` ON `notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_document_id_idx` ON `notifications` (`document_id`);--> statement-breakpoint
CREATE INDEX `notifications_actor_id_idx` ON `notifications` (`actor_id`);--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_user_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
