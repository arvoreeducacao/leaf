CREATE TABLE `documents_fts` (
	`document_id` varchar(21) NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` mediumtext NOT NULL,
	`indexed_at` datetime(3) NOT NULL,
	CONSTRAINT `documents_fts_document_id` PRIMARY KEY(`document_id`),
	FULLTEXT KEY `documents_fts_all` (`title`,`body`),
	FULLTEXT KEY `documents_fts_title` (`title`),
	FULLTEXT KEY `documents_fts_body` (`body`)
);
