UPDATE `database_views`
SET `config` = JSON_SET(`config`, '$.groupByPropertyId', CAST('null' AS JSON))
WHERE `type` = 'table'
  AND `config` IS NOT NULL
  AND JSON_VALID(`config`)
  AND JSON_TYPE(JSON_EXTRACT(`config`, '$.groupByPropertyId')) = 'STRING';
--> statement-breakpoint
UPDATE `database_view_drafts` AS `drafts`
JOIN `database_views` AS `views` ON `views`.`id` = `drafts`.`view_id`
SET `drafts`.`config` = JSON_SET(`drafts`.`config`, '$.groupByPropertyId', CAST('null' AS JSON))
WHERE `views`.`type` = 'table'
  AND `drafts`.`config` IS NOT NULL
  AND JSON_VALID(`drafts`.`config`)
  AND JSON_TYPE(JSON_EXTRACT(`drafts`.`config`, '$.groupByPropertyId')) = 'STRING';
