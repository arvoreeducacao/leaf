CREATE TABLE `document_realtime_state` (
	`document_id` varchar(21) NOT NULL,
	`identity` varchar(24) NOT NULL,
	`state` longblob NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `document_realtime_state_document_id` PRIMARY KEY(`document_id`)
);
--> statement-breakpoint
ALTER TABLE `document_realtime_state` ADD CONSTRAINT `document_realtime_state_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
