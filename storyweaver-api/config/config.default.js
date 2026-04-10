'use strict';

const path = require('path');
require('./env-loader');

/**
 * EggJS 默认配置
 * @param {import('egg').EggAppInfo} appInfo - 应用信息
 * @returns {import('egg').EggAppConfig} 配置对象
 */
module.exports = appInfo => {
  /** @type {import('egg').EggAppConfig} */
  const config = {};

  /* ========================================
   * 部署模式（核心开关）
   * network  = 商用线上版（MySQL + Redis + 短信 + 支付）
   * localhost = 本地开源版（SQLite + 无Redis + 手机号密码登录）
   * 通过环境变量 DEPLOY_MODE 控制，默认 network
   * ======================================== */
  config.deployMode = process.env.DEPLOY_MODE || 'network';

  /* 便捷判断：是否为本地开源模式 */
  const isLocal = config.deployMode === 'localhost';

  /* ========================================
   * 安全密钥
   * ======================================== */
  config.keys = appInfo.name + '_zhijuai_2026';

  /* ========================================
   * 中间件配置
   * ======================================== */
  config.middleware = ['errorHandler'];

  /* ========================================
   * 安全配置
   * ======================================== */
  config.security = {
    csrf: {
      enable: false,
    },
  };

  /* ========================================
   * CORS 跨域配置
   * ======================================== */
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    credentials: true,
  };

  /* ========================================
   * JWT 配置
   * localhost 模式下 token 设置为 365 天（永久登录态）
   * ======================================== */
  config.jwt = {
    secret: 'zhijuai_jwt_secret_2026_!@#$',
    expiresIn: isLocal ? '365d' : '7d',
  };

  /* ========================================
   * Sequelize 数据库配置
   * 根据 deployMode 自动切换 MySQL / SQLite
   * ======================================== */
  if (isLocal) {
    config.sequelize = {
      dialect: 'sqlite',
      storage: path.join(appInfo.baseDir, 'data/zhijuai.sqlite'),
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
      },
      logging: false,
    };
  } else {
    config.sequelize = {
      dialect: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      database: 'aistory_weaver',
      username: 'root',
      password: 'root',
      timezone: '+08:00',
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
      dialectOptions: {
        dateStrings: true,
        typeCast: true,
      },
    };
  }

  /* ========================================
   * 参数校验配置
   * ======================================== */
  config.validate = {
    convert: true,
    widelyUndefined: true,
  };

  /* ========================================
   * 请求体解析配置
   * ======================================== */
  config.bodyParser = {
    jsonLimit: '20mb',
    formLimit: '20mb',
  };

  /* ========================================
   * 管理后台路径前缀（安全：生产环境用随机路径防猜测）
   * 本地开发默认 /admin，生产环境在 config.prod.js 覆盖
   * ======================================== */
  config.adminPrefix = '/admin';

  /* ========================================
   * 模板渲染配置（管理后台用 Nunjucks）
   * ======================================== */
  config.view = {
    defaultViewEngine: 'nunjucks',
    mapping: {
      '.nj': 'nunjucks',
    },
  };

  /* ========================================
   * 静态资源配置
   * localhost 模式下同时托管 web/ 目录中的前端静态文件
   * ======================================== */
  if (isLocal) {
    config.static = {
      dir: [
        { prefix: '/public/', dir: path.join(appInfo.baseDir, 'app/public') },
        { prefix: '/', dir: path.join(appInfo.baseDir, 'web'), maxAge: 30 * 24 * 3600 * 1000 },
      ],
    };
  } else {
    config.static = {
      prefix: '/public/',
    };
  }

  /* ========================================
   * 文件上传配置（头像等）
   * ======================================== */
  config.multipart = {
    mode: 'file',
    fileSize: '5mb',
    whitelist: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  };

  /* ========================================
   * 日志配置
   * localhost 模式只记录 WARN 级别以上，大幅减少日志体积
   * Electron 打包后日志输出到用户数据目录，避免写在 .app 包内
   * ======================================== */
  config.logger = {
    level: isLocal ? 'WARN' : 'INFO',
    consoleLevel: isLocal ? 'WARN' : 'INFO',
  };

  if (process.env.ZHIJUAI_LOG_DIR) {
    config.logger.dir = process.env.ZHIJUAI_LOG_DIR;
  }

  if (isLocal) {
    config.logrotator = {
      maxDays: 3,
    };
  }

  /* ========================================
   * Hashids 配置（ID混淆，防止自增ID暴露）
   * ======================================== */
  config.hashids = {
    salt: 'zhijuai_hashids_salt_2026_!@#$',
    minLength: 8,
  };

  /* ========================================
   * Redis 配置（仅 network 模式使用）
   * localhost 模式下 Redis 插件不启用，此配置不生效
   * ======================================== */
  config.redis = {
    client: {
      port: 6379,
      host: '127.0.0.1',
      password: '',
      db: 6,
    },
  };

  /* ========================================
   * API Key 加密密钥（AES-256-GCM，用于加密用户存储的模型API Key）
   * ======================================== */
  config.encryption = {
    secret: 'zhijuai_enc_secret_2026_aes256gcm!',
  };

  /* ========================================
   * 集群/端口配置
   * ======================================== */
  config.cluster = {
    listen: {
      port: 7006,
      /* Docker 场景下通过环境变量改成 0.0.0.0，宿主机才能访问到容器端口 */
      hostname: process.env.LISTEN_HOST || '127.0.0.1',
    },
  };

  return config;
};
