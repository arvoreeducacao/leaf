CREATE TABLE `document_links` (
	`source_id` varchar(21) NOT NULL,
	`target_id` varchar(21) NOT NULL,
	`context` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `document_links_source_id_target_id_pk` PRIMARY KEY(`source_id`,`target_id`)
);
--> statement-breakpoint
CREATE TABLE `document_link_scans` (
	`document_id` varchar(21) NOT NULL,
	`scanned_at` datetime(3) NOT NULL,
	CONSTRAINT `document_link_scans_document_id` PRIMARY KEY(`document_id`)
);
--> statement-breakpoint
ALTER TABLE `document_links` ADD CONSTRAINT `document_links_source_id_documents_id_fk` FOREIGN KEY (`source_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_links` ADD CONSTRAINT `document_links_target_id_documents_id_fk` FOREIGN KEY (`target_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_link_scans` ADD CONSTRAINT `document_link_scans_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_links_target_id_idx` ON `document_links` (`target_id`);
