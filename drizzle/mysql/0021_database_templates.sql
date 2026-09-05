ALTER TABLE `documents` MODIFY COLUMN `kind` enum('page','database','row','template') NOT NULL DEFAULT 'page';--> statement-breakpoint
ALTER TABLE `documents` ADD `default_template_id` varchar(21);--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_default_template_id_documents_id_fk` FOREIGN KEY (`default_template_id`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;
