CREATE TABLE `document_favorites` (
	`id` varchar(21) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `document_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_favorites_user_document_idx` UNIQUE(`user_id`,`document_id`)
);
--> statement-breakpoint
ALTER TABLE `document_favorites` ADD CONSTRAINT `document_favorites_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_favorites` ADD CONSTRAINT `document_favorites_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_favorites_user_id_idx` ON `document_favorites` (`user_id`);
