-- ============================================
-- 小说项目版权确认字段迁移脚本
-- 执行时间：2026-03-14
-- 用途：为小说转剧本项目补充版权确认留痕
-- ============================================

ALTER TABLE `novel_project`
ADD COLUMN `copyright_confirmed` TINYINT NOT NULL DEFAULT 0 COMMENT '是否完成版权确认' AFTER `characters_locked`,
ADD COLUMN `copyright_confirm_text` TEXT NULL COMMENT '版权确认文案' AFTER `copyright_confirmed`,
ADD COLUMN `copyright_confirm_version` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '版权确认文案版本' AFTER `copyright_confirm_text`,
ADD COLUMN `copyright_confirmed_ip` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '版权确认时的客户端IP' AFTER `copyright_confirm_version`,
ADD COLUMN `copyright_confirmed_at` DATETIME NULL COMMENT '版权确认时间' AFTER `copyright_confirmed_ip`;

-- 可选验证
SELECT
  `id`,
  `user_id`,
  `title`,
  `copyright_confirmed`,
  `copyright_confirm_version`,
  `copyright_confirmed_ip`,
  `copyright_confirmed_at`
FROM `novel_project`
LIMIT 5;
