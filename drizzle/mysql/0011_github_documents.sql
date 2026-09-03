CREATE TABLE `github_documents` (
	`user_id` varchar(36) NOT NULL,
	`github_id` varchar(191) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`kind` enum('database','row','repo') NOT NULL DEFAULT 'row',
	`updated_at` datetime(3),
	`synced_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `github_documents_user_id_github_id_pk` PRIMARY KEY(`user_id`,`github_id`)
);
--> statement-breakpoint
ALTER TABLE `github_documents` ADD CONSTRAINT `github_documents_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `github_documents` ADD CONSTRAINT `github_documents_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `github_documents_document_id_idx` ON `github_documents` (`document_id`);
