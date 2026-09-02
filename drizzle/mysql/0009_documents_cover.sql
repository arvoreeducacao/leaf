ALTER TABLE `documents` ADD `cover` varchar(2048);
--> statement-breakpoint
ALTER TABLE `documents` ADD `cover_position` int NOT NULL DEFAULT 50;
--> statement-breakpoint
ALTER TABLE `documents` ADD `cover_credit` varchar(1024);