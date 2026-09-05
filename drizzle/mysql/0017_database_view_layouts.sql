ALTER TABLE `database_views` MODIFY COLUMN `type` enum('table','board','gallery','list','calendar','timeline') NOT NULL DEFAULT 'table';
