-- ============================================
-- 清理旧版代理与积分体系遗留表
-- 执行时间：2026-03-28
-- 用途：删除已退出业务链路的代理表、积分规则表、积分套餐表、积分流水表
-- ============================================

-- 1. 删除旧代理体系
DROP TABLE IF EXISTS `agent`;

-- 2. 删除旧积分流水
DROP TABLE IF EXISTS `point_log`;

-- 3. 删除旧积分规则
DROP TABLE IF EXISTS `point_rule`;

-- 4. 删除旧积分充值套餐
DROP TABLE IF EXISTS `points_package`;
