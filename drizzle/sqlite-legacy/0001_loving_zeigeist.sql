ALTER TABLE `documents` ADD `parent_id` text REFERENCES documents(id);--> statement-breakpoint
CREATE INDEX `documents_parent_id_idx` ON `documents` (`parent_id`);