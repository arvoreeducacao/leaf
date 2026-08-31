CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`issuer` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` varchar(512),
	`password` varchar(512),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` varchar(21) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`parent_id` varchar(21),
	`block_id` varchar(64),
	`author_id` varchar(36),
	`body` varchar(2000) NOT NULL,
	`resolved_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_shares` (
	`id` varchar(21) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`grantee_email` varchar(255) NOT NULL,
	`role` enum('viewer','commenter','editor') NOT NULL DEFAULT 'viewer',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `document_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_shares_doc_email_unq` UNIQUE(`document_id`,`grantee_email`)
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` varchar(21) NOT NULL,
	`document_id` varchar(21) NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` longtext,
	`author_id` varchar(36),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `document_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(21) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`parent_id` varchar(21),
	`org_id` varchar(21),
	`teamspace_id` varchar(21),
	`org_access` enum('viewer','commenter','editor'),
	`title` varchar(500) NOT NULL DEFAULT 'Sem título',
	`content` longtext,
	`public_token` varchar(64),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `organization_invites` (
	`id` varchar(21) NOT NULL,
	`org_id` varchar(21) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` enum('admin','member') NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organization_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_invites_org_email_unq` UNIQUE(`org_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` varchar(21) NOT NULL,
	`org_id` varchar(21) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_members_org_user_unq` UNIQUE(`org_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(21) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` varchar(512),
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `teamspace_members` (
	`id` varchar(21) NOT NULL,
	`teamspace_id` varchar(21) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `teamspace_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `teamspace_members_teamspace_user_unq` UNIQUE(`teamspace_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `teamspaces` (
	`id` varchar(21) NOT NULL,
	`org_id` varchar(21) NOT NULL,
	`name` varchar(255) NOT NULL,
	`access` enum('open','closed') NOT NULL DEFAULT 'open',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `teamspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL,
	`image` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` varchar(2048) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_comments_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_shares` ADD CONSTRAINT `document_shares_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_parent_id_documents_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_teamspace_id_teamspaces_id_fk` FOREIGN KEY (`teamspace_id`) REFERENCES `teamspaces`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_invites` ADD CONSTRAINT `organization_invites_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamspace_members` ADD CONSTRAINT `teamspace_members_teamspace_id_teamspaces_id_fk` FOREIGN KEY (`teamspace_id`) REFERENCES `teamspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamspace_members` ADD CONSTRAINT `teamspace_members_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamspaces` ADD CONSTRAINT `teamspaces_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comments_document_id_created_at_idx` ON `comments` (`document_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_parent_id_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_author_id_idx` ON `comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `document_shares_grantee_email_idx` ON `document_shares` (`grantee_email`);--> statement-breakpoint
CREATE INDEX `document_versions_document_id_created_at_idx` ON `document_versions` (`document_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `document_versions_author_id_idx` ON `document_versions` (`author_id`);--> statement-breakpoint
CREATE INDEX `documents_owner_id_idx` ON `documents` (`owner_id`);--> statement-breakpoint
CREATE INDEX `documents_parent_id_idx` ON `documents` (`parent_id`);--> statement-breakpoint
CREATE INDEX `documents_org_id_idx` ON `documents` (`org_id`);--> statement-breakpoint
CREATE INDEX `documents_teamspace_id_idx` ON `documents` (`teamspace_id`);--> statement-breakpoint
CREATE INDEX `organization_invites_email_idx` ON `organization_invites` (`email`);--> statement-breakpoint
CREATE INDEX `organization_members_user_id_idx` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `teamspace_members_user_id_idx` ON `teamspace_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `teamspaces_org_id_idx` ON `teamspaces` (`org_id`);