-- ============================================================
-- 迁移脚本：JSON 列 → TEXT（兼容 MySQL 5.6 / 5.7 早期版本）
-- 适用数据库：aistory_weaver
-- 执行方式：登录服务器 MySQL 后 source 本文件，或在 phpMyAdmin 中执行
-- ============================================================

-- 1. feedback.images（截图URL数组）
ALTER TABLE `feedback`
  MODIFY COLUMN `images` text DEFAULT NULL COMMENT '截图URL数组，JSON字符串如["url1","url2"]';

-- 2. novel_chat_history.tool_calls（工具调用记录）
ALTER TABLE `novel_chat_history`
  MODIFY COLUMN `tool_calls` text DEFAULT NULL COMMENT '工具调用记录(JSON字符串)';

-- 3. novel_episode.data（完整大纲数据）
ALTER TABLE `novel_episode`
  MODIFY COLUMN `data` text DEFAULT NULL COMMENT '完整大纲数据(EpisodeData JSON字符串，对齐Toonflow)';

-- 4. novel_episode.chapter_range（章节范围）
ALTER TABLE `novel_episode`
  MODIFY COLUMN `chapter_range` text DEFAULT NULL COMMENT '对应原著章节范围(JSON数组字符串)';

-- 5. novel_episode.outline_detail（结构化字段）
ALTER TABLE `novel_episode`
  MODIFY COLUMN `outline_detail` text DEFAULT NULL COMMENT '结构化字段(JSON字符串，含scenes/props/hooks等)';

-- 6. novel_project.genres（题材类型）
ALTER TABLE `novel_project`
  MODIFY COLUMN `genres` text DEFAULT NULL COMMENT '题材类型数组(JSON字符串)';

-- 7. recharge_order.product_detail（商品详情）
ALTER TABLE `recharge_order`
  MODIFY COLUMN `product_detail` text DEFAULT NULL COMMENT '商品详情(JSON字符串)';

-- 8. script.params（创作参数）
ALTER TABLE `script`
  MODIFY COLUMN `params` text DEFAULT NULL COMMENT '创作参数(JSON字符串，含集数、时长、性别、题材等)';
