CREATE TABLE `notion_documents` (
	`user_id` varchar(36) NOT NULL,
	`notion_id` varchar(64) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`parent_notion_id` varchar(64),
	`kind` enum('page','database','row') NOT NULL DEFAULT 'page',
	`last_edited_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notion_documents_user_id_notion_id_pk` PRIMARY KEY(`user_id`,`notion_id`)
);
--> statement-breakpoint
ALTER TABLE `notion_documents` ADD CONSTRAINT `notion_documents_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `notion_documents` ADD CONSTRAINT `notion_documents_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `notion_documents_document_id_idx` ON `notion_documents` (`document_id`);
--> statement-breakpoint
CREATE INDEX `notion_documents_user_parent_idx` ON `notion_documents` (`user_id`,`parent_notion_id`);
