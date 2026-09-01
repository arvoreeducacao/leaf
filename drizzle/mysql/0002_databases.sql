CREATE TABLE `database_properties` (
	`id` varchar(21) NOT NULL,
	`database_id` varchar(21) NOT NULL,
	`name` varchar(120) NOT NULL,
	`type` enum('text','number','select','multiSelect','date','checkbox','url') NOT NULL DEFAULT 'text',
	`options` longtext,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `database_properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `database_views` (
	`id` varchar(21) NOT NULL,
	`database_id` varchar(21) NOT NULL,
	`name` varchar(120) NOT NULL,
	`type` enum('table','board') NOT NULL DEFAULT 'table',
	`config` longtext,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `database_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `kind` enum('page','database','row') DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `properties` longtext;--> statement-breakpoint
ALTER TABLE `database_properties` ADD CONSTRAINT `database_properties_database_id_documents_id_fk` FOREIGN KEY (`database_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `database_views` ADD CONSTRAINT `database_views_database_id_documents_id_fk` FOREIGN KEY (`database_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `database_properties_database_id_position_idx` ON `database_properties` (`database_id`,`position`);--> statement-breakpoint
CREATE INDEX `database_views_database_id_position_idx` ON `database_views` (`database_id`,`position`);--> statement-breakpoint
CREATE INDEX `documents_kind_parent_id_idx` ON `documents` (`kind`,`parent_id`);