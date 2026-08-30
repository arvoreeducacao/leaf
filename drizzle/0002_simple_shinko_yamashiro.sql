CREATE TABLE `organization_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invites_org_email_unq` ON `organization_invites` (`org_id`,`email`);--> statement-breakpoint
CREATE INDEX `organization_invites_email_idx` ON `organization_invites` (`email`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_org_user_unq` ON `organization_members` (`org_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `organization_members_user_id_idx` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `org_id` text REFERENCES organizations(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `org_access` text;--> statement-breakpoint
CREATE INDEX `documents_org_id_idx` ON `documents` (`org_id`);