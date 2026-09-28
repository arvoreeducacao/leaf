CREATE TABLE `document_visits` (
	`user_id` varchar(36) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`visited_at` datetime(3) NOT NULL,
	CONSTRAINT `document_visits_user_id_document_id_pk` PRIMARY KEY(`user_id`,`document_id`)
);
--> statement-breakpoint
ALTER TABLE `document_visits` ADD CONSTRAINT `document_visits_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_visits` ADD CONSTRAINT `document_visits_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_visits_user_visited_idx` ON `document_visits` (`user_id`,`visited_at`);--> statement-breakpoint
CREATE INDEX `document_visits_document_id_idx` ON `document_visits` (`document_id`);
