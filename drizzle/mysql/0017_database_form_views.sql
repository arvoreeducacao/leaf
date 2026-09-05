ALTER TABLE `database_views` MODIFY COLUMN `type` enum('table','board','form') NOT NULL DEFAULT 'table';--> statement-breakpoint
ALTER TABLE `database_views` ADD `public_token` varchar(64);--> statement-breakpoint
ALTER TABLE `database_views` ADD CONSTRAINT `database_views_public_token_unique` UNIQUE(`public_token`);
