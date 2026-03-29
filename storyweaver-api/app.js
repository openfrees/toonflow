'use strict';

const path = require('path');
const fs = require('fs');

/**
 * 应用启动初始化
 * 根据 deployMode 自动适配 network / localhost 模式
 */
module.exports = app => {
  const isLocal = app.config.deployMode === 'localhost';

  /* localhost 模式：挂载内存缓存到 app.redis（兼容现有代码中 app.redis 的调用） */
  if (isLocal) {
    const MemoryCache = require('./app/lib/cache');
    app.redis = new MemoryCache();
    app.logger.info('[Init] localhost 模式 → 使用内存缓存替代 Redis');
  }

  app.ready(async () => {
    if (isLocal) {
      /* 确保 data 目录存在 */
      const dataDir = path.join(app.baseDir, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      /* Sequelize sync 自动建表（表已存在则跳过） */
      try {
        await app.model.sync({ alter: false });
        app.logger.info('[Init] SQLite 建表完成');
      } catch (err) {
        app.logger.error('[Init] SQLite 建表失败:', err);
      }

      /* 写入种子数据（各表为空时才写入，不影响已有数据） */
      await _seedData(app);
    }

    app.logger.info('[Init] 应用启动完成 (deployMode=%s)', app.config.deployMode);
  });
};

/**
 * localhost 模式 - 种子数据初始化
 * 仅在对应表为空时写入，保证幂等（重启不会重复插入）
 * @param {import('egg').Application} app
 * @private
 */
async function _seedData(app) {
  const bcrypt = require('bcryptjs');
  const { genres, systemConfigs } = require('./app/lib/seed_data');

  /* 管理员账号 */
  try {
    const adminCount = await app.model.AdminUser.count();
    if (adminCount === 0) {
      await app.model.AdminUser.create({
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        real_name: '管理员',
        status: 1,
      });
      app.logger.info('[Seed] 已创建默认管理员，请查阅文档获取初始密码');
    }
  } catch (err) {
    app.logger.warn('[Seed] 管理员初始化失败:', err.message);
  }

  /* 题材类型（genre） */
  try {
    const genreCount = await app.model.Genre.count();
    if (genreCount === 0) {
      await app.model.Genre.bulkCreate(
        genres.map(g => ({ ...g, is_enabled: 1 }))
      );
      app.logger.info('[Seed] 已写入 %d 条题材类型', genres.length);
    }
  } catch (err) {
    app.logger.warn('[Seed] 题材类型初始化失败:', err.message);
  }

  /* 系统配置（system_config） */
  try {
    const configCount = await app.model.SystemConfig.count();
    if (configCount === 0) {
      await app.model.SystemConfig.bulkCreate(systemConfigs);
      app.logger.info('[Seed] 已写入 %d 条系统配置', systemConfigs.length);
    }
  } catch (err) {
    app.logger.warn('[Seed] 系统配置初始化失败:', err.message);
  }
}
