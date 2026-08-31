CREATE VIRTUAL TABLE `documents_fts` USING fts5(
	`document_id` UNINDEXED,
	`title`,
	`body`,
	`indexed_at` UNINDEXED,
	tokenize = 'unicode61 remove_diacritics 2'
);
