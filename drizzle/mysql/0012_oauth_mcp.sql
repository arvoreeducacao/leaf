CREATE TABLE `jwks` (
	`id` varchar(36) NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`alg` varchar(16),
	`crv` varchar(16),
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3),
	CONSTRAINT `jwks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255),
	`client_id` varchar(64) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36),
	`reference_id` varchar(64),
	`authorization_code_id` varchar(255),
	`refresh_id` varchar(36),
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`confirmation` text,
	`revoked` datetime(3),
	`expires_at` datetime(3),
	`created_at` datetime(3),
	CONSTRAINT `oauth_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_access_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `oauth_client_assertions` (
	`id` varchar(128) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `oauth_client_assertions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_client_resources` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`resource_id` varchar(512) NOT NULL,
	`metadata` text,
	`created_at` datetime(3),
	CONSTRAINT `oauth_client_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_client_resources_client_resource_unq` UNIQUE(`client_id`,`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`client_secret` varchar(255),
	`client_discovery_id` varchar(64),
	`disabled` boolean NOT NULL DEFAULT false,
	`skip_consent` boolean,
	`enable_end_session` boolean,
	`subject_type` varchar(16),
	`scopes` text,
	`client_credentials_scopes` text,
	`user_id` varchar(36),
	`reference_id` varchar(64),
	`name` varchar(255),
	`uri` varchar(2048),
	`icon` varchar(2048),
	`contacts` text,
	`tos` varchar(2048),
	`policy` varchar(2048),
	`software_id` varchar(255),
	`software_version` varchar(64),
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`backchannel_logout_uri` varchar(2048),
	`backchannel_logout_session_required` boolean,
	`token_endpoint_auth_method` varchar(32),
	`application_type` varchar(16),
	`jwks` text,
	`jwks_uri` varchar(2048),
	`grant_types` text,
	`response_types` text,
	`require_pkce` boolean,
	`dpop_bound_access_tokens` boolean NOT NULL DEFAULT false,
	`metadata` text,
	`created_at` datetime(3),
	`updated_at` datetime(3),
	CONSTRAINT `oauth_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_clients_client_id_unique` UNIQUE(`client_id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_consents` (
	`id` varchar(36) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`user_id` varchar(36),
	`reference_id` varchar(64),
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`created_at` datetime(3),
	`updated_at` datetime(3),
	CONSTRAINT `oauth_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`client_id` varchar(64) NOT NULL,
	`session_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`reference_id` varchar(64),
	`authorization_code_id` varchar(255),
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`confirmation` text,
	`rotation_replay_response` text,
	`rotation_replay_expires_at` datetime(3),
	`rotated_at` datetime(3),
	`auth_time` datetime(3),
	`revoked` datetime(3),
	`expires_at` datetime(3),
	`created_at` datetime(3),
	CONSTRAINT `oauth_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_refresh_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `oauth_resources` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(512) NOT NULL,
	`name` varchar(255) NOT NULL,
	`access_token_ttl` int,
	`refresh_token_ttl` int,
	`signing_algorithm` varchar(16),
	`signing_key_id` varchar(36),
	`allowed_scopes` text,
	`custom_claims` text,
	`dpop_bound_access_tokens_required` boolean NOT NULL DEFAULT false,
	`disabled` boolean NOT NULL DEFAULT false,
	`policy_version` int NOT NULL DEFAULT 1,
	`metadata` text,
	`created_at` datetime(3),
	`updated_at` datetime(3),
	CONSTRAINT `oauth_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_resources_identifier_unique` UNIQUE(`identifier`)
);
--> statement-breakpoint
ALTER TABLE `database_properties` MODIFY COLUMN `type` enum('text','number','select','multiSelect','date','checkbox','url','person','status') NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD CONSTRAINT `oauth_access_tokens_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD CONSTRAINT `oauth_access_tokens_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD CONSTRAINT `oauth_access_tokens_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_access_tokens` ADD CONSTRAINT `oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk` FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_tokens`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_client_resources` ADD CONSTRAINT `oauth_client_resources_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_client_resources` ADD CONSTRAINT `oauth_client_resources_resource_id_oauth_resources_identifier_fk` FOREIGN KEY (`resource_id`) REFERENCES `oauth_resources`(`identifier`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_clients` ADD CONSTRAINT `oauth_clients_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_consents` ADD CONSTRAINT `oauth_consents_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_consents` ADD CONSTRAINT `oauth_consents_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD CONSTRAINT `oauth_refresh_tokens_client_id_oauth_clients_client_id_fk` FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD CONSTRAINT `oauth_refresh_tokens_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD CONSTRAINT `oauth_refresh_tokens_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_client_id_idx` ON `oauth_access_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_user_id_idx` ON `oauth_access_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_session_id_idx` ON `oauth_access_tokens` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_authorization_code_id_idx` ON `oauth_access_tokens` (`authorization_code_id`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_refresh_id_idx` ON `oauth_access_tokens` (`refresh_id`);--> statement-breakpoint
CREATE INDEX `oauth_clients_user_id_idx` ON `oauth_clients` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_consents_client_id_idx` ON `oauth_consents` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_consents_user_id_idx` ON `oauth_consents` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_client_id_idx` ON `oauth_refresh_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_user_id_idx` ON `oauth_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_session_id_idx` ON `oauth_refresh_tokens` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_authorization_code_id_idx` ON `oauth_refresh_tokens` (`authorization_code_id`);