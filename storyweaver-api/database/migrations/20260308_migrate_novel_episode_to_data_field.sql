-- ============================================
-- 数据库迁移脚本：对齐 Toonflow 大纲存储结构
-- 执行时间：2026-03-08
-- ============================================

-- 1. 备份现有数据（重要！）
CREATE TABLE IF NOT EXISTS `novel_episode_backup_20260308` LIKE `novel_episode`;
INSERT INTO `novel_episode_backup_20260308` SELECT * FROM `novel_episode`;

-- 2. 添加新的 data 字段（JSON 类型）
ALTER TABLE `novel_episode`
ADD COLUMN `data` JSON COMMENT '完整大纲数据(EpisodeData JSON，对齐Toonflow)' AFTER `episode_number`;

-- 3. 迁移现有数据到 data 字段
-- 将 title, chapter_range, outline, outline_detail 合并到 data 字段
UPDATE `novel_episode`
SET `data` = JSON_OBJECT(
  'episodeIndex', `episode_number`,
  'title', COALESCE(`title`, ''),
  'chapterRange', COALESCE(`chapter_range`, JSON_ARRAY()),
  'outline', COALESCE(`outline`, ''),
  'coreConflict', COALESCE(JSON_EXTRACT(`outline_detail`, '$.coreConflict'), ''),
  'openingHook', COALESCE(JSON_EXTRACT(`outline_detail`, '$.openingHook'), ''),
  'endingHook', COALESCE(JSON_EXTRACT(`outline_detail`, '$.endingHook'), ''),
  'keyEvents', COALESCE(JSON_EXTRACT(`outline_detail`, '$.keyEvents'), JSON_ARRAY()),
  'emotionalCurve', COALESCE(JSON_EXTRACT(`outline_detail`, '$.emotionalCurve'), ''),
  'visualHighlights', COALESCE(JSON_EXTRACT(`outline_detail`, '$.visualHighlights'), JSON_ARRAY()),
  'classicQuotes', COALESCE(JSON_EXTRACT(`outline_detail`, '$.classicQuotes'), JSON_ARRAY()),
  'characters', COALESCE(JSON_EXTRACT(`outline_detail`, '$.characters'), JSON_ARRAY()),
  'scenes', COALESCE(JSON_EXTRACT(`outline_detail`, '$.scenes'), JSON_ARRAY()),
  'props', COALESCE(JSON_EXTRACT(`outline_detail`, '$.props'), JSON_ARRAY())
)
WHERE `data` IS NULL;

-- 4. 删除旧字段（谨慎操作！确认数据迁移成功后再执行）
-- ALTER TABLE `novel_episode` DROP COLUMN `title`;
-- ALTER TABLE `novel_episode` DROP COLUMN `chapter_range`;
-- ALTER TABLE `novel_episode` DROP COLUMN `outline`;
-- ALTER TABLE `novel_episode` DROP COLUMN `outline_detail`;

-- 5. 验证迁移结果
SELECT
  id,
  episode_number,
  JSON_EXTRACT(data, '$.title') as title,
  JSON_EXTRACT(data, '$.outline') as outline,
  outline_locked,
  created_at
FROM `novel_episode`
LIMIT 5;

-- ============================================
-- 说明：
-- 1. 执行前请先备份数据库
-- 2. 第4步删除旧字段的操作已注释，确认无误后再执行
-- 3. 如需回滚，使用备份表恢复：
--    DROP TABLE `novel_episode`;
--    RENAME TABLE `novel_episode_backup_20260308` TO `novel_episode`;
-- ============================================
