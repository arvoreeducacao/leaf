CREATE TABLE `document_chunks` (
	`document_id` varchar(21) NOT NULL,
	`chunk_index` int NOT NULL,
	`body` mediumtext NOT NULL,
	`embedding` blob NOT NULL,
	`model` varchar(120) NOT NULL,
	`indexed_at` datetime(3) NOT NULL,
	CONSTRAINT `document_chunks_document_id_chunk_index_pk` PRIMARY KEY(`document_id`,`chunk_index`)
);
--> statement-breakpoint
ALTER TABLE `document_chunks` ADD CONSTRAINT `document_chunks_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `document_chunks_indexed_at_idx` ON `document_chunks` (`indexed_at`);
