'use strict';

require('./env-loader');

/**
 * 插件配置
 * @see https://eggjs.org/zh-cn/basics/plugin.html
 */

/** Sequelize ORM */
exports.sequelize = {
  enable: true,
  package: 'egg-sequelize',
};

/** 跨域支持 */
exports.cors = {
  enable: true,
  package: 'egg-cors',
};

/** JWT 鉴权 */
exports.jwt = {
  enable: true,
  package: 'egg-jwt',
};

/** 参数校验 */
exports.validate = {
  enable: true,
  package: 'egg-validate',
};

/** Nunjucks 模板引擎 */
exports.nunjucks = {
  enable: true,
  package: 'egg-view-nunjucks',
};

/** Redis 缓存（仅 network 模式启用，localhost 模式不需要） */
exports.redis = {
  enable: process.env.DEPLOY_MODE !== 'localhost',
  package: 'egg-redis',
};
