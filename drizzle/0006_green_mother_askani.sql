CREATE TABLE `teamspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`teamspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`teamspace_id`) REFERENCES `teamspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teamspace_members_teamspace_user_unq` ON `teamspace_members` (`teamspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `teamspace_members_user_id_idx` ON `teamspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `teamspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`access` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teamspaces_org_id_idx` ON `teamspaces` (`org_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `teamspace_id` text REFERENCES teamspaces(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `documents_teamspace_id_idx` ON `documents` (`teamspace_id`);