ALTER TABLE `database_views` MODIFY COLUMN `type` enum('table','board','form','gallery','list','calendar','timeline') NOT NULL DEFAULT 'table';
