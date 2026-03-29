'use strict';

const Service = require('egg').Service;

/**
 * 管理后台 - 系统配置服务
 * 键值对形式管理系统级配置（功能开关、赠送额度等）
 */
class SystemConfigService extends Service {
  /**
   * 需要按上传文件方式清理旧资源的系统配置键
   * @returns {string[]}
   */
  getUploadConfigKeys() {
    return [ 'customer_service_qr' ];
  }

  /**
   * 前端公开配置默认值
   * 只放无需鉴权、可安全暴露给 C 端的配置
   * @returns {object}
   */
  getPublicConfigDefaults() {
    return {
      manual_link: 'https://docs.qq.com/',
      customer_service_qr: '',
    };
  }


  /**
   * 获取所有系统配置
   * @returns {Promise<Array>}
   */
  async getAll() {
    const { ctx } = this;
    const list = await ctx.model.SystemConfig.findAll({
      order: [['id', 'ASC']],
      raw: true,
    });
    return list.map(item => ({
      ...item,
      id: String(item.id),
    }));
  }

  /**
   * 根据 func_key 获取配置值
   * @param {string} funcKey - 功能键名
   * @returns {Promise<string|null>} 功能值，不存在返回 null
   */
  async getValue(funcKey) {
    const { ctx } = this;
    const config = await ctx.model.SystemConfig.findOne({
      where: { func_key: funcKey },
      raw: true,
    });
    return config ? config.func_value : null;
  }

  /**
   * 批量获取配置值
   * @param {string[]} funcKeys - 配置键名列表
   * @returns {Promise<object>} { key: value }
   */
  async getValues(funcKeys = []) {
    const { ctx } = this;
    if (!Array.isArray(funcKeys) || funcKeys.length === 0) {
      return {};
    }

    const list = await ctx.model.SystemConfig.findAll({
      where: { func_key: funcKeys },
      raw: true,
    });

    return list.reduce((acc, item) => {
      acc[item.func_key] = item.func_value;
      return acc;
    }, {});
  }

  /**
   * 获取提供给前端侧边栏使用的公开配置
   * @returns {Promise<object>}
   */
  async getPublicConfig() {
    const defaults = this.getPublicConfigDefaults();
    const values = await this.getValues(Object.keys(defaults));
    return {
      manual_link: values.manual_link || defaults.manual_link,
      customer_service_qr: values.customer_service_qr || defaults.customer_service_qr,
    };
  }

  /**
   * 保存配置（有则更新，无则新增）
   * @param {object} data - { func_key, func_value, func_desc }
   * @returns {Promise<object>}
   */
  async save(data) {
    const { ctx } = this;
    const { func_key, func_value, func_desc, cleanup_paths } = data;
    const nextValue = func_value == null ? '' : String(func_value);

    if (!func_key) {
      throw new Error('功能键名不能为空');
    }

    const existing = await ctx.model.SystemConfig.findOne({
      where: { func_key },
    });

    if (existing) {
      const previousValue = existing.func_value || '';

      /* 更新 */
      await existing.update({
        func_value: nextValue,
        func_desc: func_desc ?? existing.func_desc,
      });

      this.cleanupConfigUploads(func_key, previousValue, nextValue, cleanup_paths);
      return { ...existing.get({ plain: true }), id: String(existing.id) };
    }

    /* 新增 */
    const created = await ctx.model.SystemConfig.create({
      func_key,
      func_value: nextValue,
      func_desc: func_desc || '',
    });

    this.cleanupConfigUploads(func_key, '', nextValue, cleanup_paths);
    return { ...created.get({ plain: true }), id: String(created.id) };
  }

  /**
   * 清理系统配置中替换/清空后遗留的本地上传文件
   * 只有点击保存后才会执行，和配置持久化保持一致
   * @param {string} funcKey - 配置键
   * @param {string} previousValue - 旧值
   * @param {string} nextValue - 新值
   * @param {string[]} cleanupPaths - 前端上报的待清理临时路径
   */
  cleanupConfigUploads(funcKey, previousValue, nextValue, cleanupPaths = []) {
    const { ctx } = this;
    if (!this.getUploadConfigKeys().includes(funcKey)) {
      return;
    }

    const paths = new Set(Array.isArray(cleanupPaths) ? cleanupPaths : []);

    if (previousValue && previousValue !== nextValue) {
      paths.add(previousValue);
    }

    for (const filePath of paths) {
      if (!filePath || filePath === nextValue) continue;
      ctx.helper.removeUploadedFile(filePath);
    }
  }
}

module.exports = SystemConfigService;
