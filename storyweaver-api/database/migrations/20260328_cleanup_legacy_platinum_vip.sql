-- ============================================
-- 清理旧版 platinum 会员档位
-- 执行时间：2026-03-28
-- 用途：将遗留 platinum 用户与订单迁移到基础会员，并删除旧档位与旧价格
-- ============================================

-- 1. 将旧 platinum 用户迁移到 gold（基础会员）
UPDATE `user`
SET `vip_tier_id` = (SELECT `id` FROM `vip_tier` WHERE `tier_code` = 'gold' LIMIT 1)
WHERE `vip_tier_id` = (SELECT `id` FROM `vip_tier` WHERE `tier_code` = 'platinum' LIMIT 1);

-- 2. 将未终态 platinum 订单迁移到 gold，避免后续履约失败
UPDATE `recharge_order`
SET `product_detail` = REPLACE(`product_detail`, '\"tierCode\":\"platinum\"', '\"tierCode\":\"gold\"')
WHERE `order_type` = 'vip'
  AND (`status` = 0 OR `status` = 2)
  AND `product_detail` LIKE '%"tierCode":"platinum"%';

-- 3. 删除旧 platinum 价格矩阵
DELETE FROM `vip_price`
WHERE `vip_tier_id` = (SELECT `id` FROM `vip_tier` WHERE `tier_code` = 'platinum' LIMIT 1);

-- 4. 删除旧 platinum 档位
DELETE FROM `vip_tier`
WHERE `tier_code` = 'platinum';

-- 5. 对齐当前档位名称
UPDATE `vip_tier`
SET `name` = CASE
  WHEN `tier_code` = 'gold' THEN '基础会员'
  WHEN `tier_code` = 'blackgold' THEN '高级会员'
  ELSE `name`
END
WHERE `tier_code` IN ('gold', 'blackgold');
