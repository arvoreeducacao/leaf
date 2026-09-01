ALTER TABLE `organizations` ADD `invite_token` varchar(64);--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_invite_token_unique` UNIQUE(`invite_token`);