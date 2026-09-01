ALTER TABLE `database_properties` MODIFY COLUMN `type` enum('text','number','select','multiSelect','date','checkbox','url','person','status') NOT NULL DEFAULT 'text';
