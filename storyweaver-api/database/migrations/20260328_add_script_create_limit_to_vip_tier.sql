-- ============================================
-- 会员档位创作额度迁移脚本
-- 执行时间：2026-03-28
-- 用途：为商用模式会员档位补充剧本创建上限，并同步默认创作额度
-- ============================================

ALTER TABLE `vip_tier`
ADD COLUMN `script_create_limit` INT NOT NULL DEFAULT 0 COMMENT '最多可创建剧本数，0=不限' AFTER `monthly_coins`;

-- 对齐新的会员额度规则
-- gold -> 基础会员：30 个剧本，100 万字
-- blackgold -> 高级会员：100 个剧本，200 万字
UPDATE `vip_tier`
SET
  `script_create_limit` = CASE
    WHEN `tier_code` = 'gold' THEN 30
    WHEN `tier_code` = 'blackgold' THEN 100
    ELSE `script_create_limit`
  END,
  `novel_word_limit` = CASE
    WHEN `tier_code` = 'gold' THEN 1000000
    WHEN `tier_code` = 'blackgold' THEN 2000000
    ELSE `novel_word_limit`
  END
WHERE `tier_code` IN ('gold', 'blackgold');

-- 可选校验
SELECT
  `tier_code`,
  `name`,
  `script_create_limit`,
  `novel_word_limit`,
  `sort_order`
FROM `vip_tier`
ORDER BY `sort_order` ASC, `id` ASC;
