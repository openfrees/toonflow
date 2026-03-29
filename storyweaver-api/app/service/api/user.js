'use strict';

const Service = require('egg').Service;
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const dayjs = require('dayjs');

/**
 * C端用户资料服务
 * 处理用户资料更新、头像上传等业务逻辑
 */
class UserService extends Service {

  /**
   * 更新用户资料（昵称）
   * @param {number} userId - 用户ID
   * @param {object} data - 更新数据
   * @param {string} data.nickname - 新昵称
   * @returns {Promise<object>} 更新后的用户信息
   */
  async updateProfile(userId, data) {
    const { ctx } = this;

    /* 构建更新字段，只允许更新昵称 */
    const updateData = {};

    if (data.nickname !== undefined) {
      const nickname = data.nickname.trim();
      if (!nickname) {
        throw new Error('昵称不能为空');
      }
      if (nickname.length > 20) {
        throw new Error('昵称不能超过20个字符');
      }
      updateData.nickname = nickname;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('没有需要更新的内容');
    }

    /* 执行更新 */
    await ctx.model.User.update(updateData, {
      where: { id: userId },
    });

    /* 查询更新后的用户信息 */
    const user = await ctx.model.User.findOne({
      where: { id: userId },
      attributes: { exclude: ['password'] },
      raw: true,
    });

    return ctx.service.api.auth._formatUserInfo(user);
  }

  /**
   * 上传并更新用户头像
   * @param {number} userId - 用户ID
   * @param {object} file - EggJS multipart 文件对象
   * @returns {Promise<object>} 更新后的用户信息
   */
  async uploadAvatar(userId, file) {
    const { ctx, app } = this;

    /* 查询旧头像（更新前查询，用于后续清理旧文件） */
    const oldUser = await ctx.model.User.findOne({
      where: { id: userId },
      attributes: ['avatar'],
      raw: true,
    });

    /* 确保上传目录存在 */
    const uploadDir = path.join(app.baseDir, 'app/public/uploads/avatar');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    /* 统一输出为 .jpg，压缩体积 */
    const filename = `${userId}_${Date.now()}.jpg`;
    const targetPath = path.join(uploadDir, filename);

    /*
     * 图片处理：
     * 1. 居中裁剪为正方形（cover策略，取中间区域）
     * 2. 等比缩放到 400x400（头像不需要太大）
     * 3. 转为 JPEG 质量80%，大幅压缩体积
     */
    await sharp(file.filepath)
      .resize(400, 400, {
        fit: 'cover',       /* 居中裁剪，长边裁掉两头 */
        position: 'centre', /* 从中心裁剪 */
      })
      .jpeg({ quality: 80 })
      .toFile(targetPath);

    /* 清理临时文件 */
    await ctx.cleanupRequestFiles();

    /* 生成可访问的URL */
    const avatarUrl = `/public/uploads/avatar/${filename}`;

    /* 更新数据库 */
    await ctx.model.User.update(
      { avatar: avatarUrl },
      { where: { id: userId } }
    );

    /* 清理旧头像文件（仅清理本地上传的） */
    if (oldUser && oldUser.avatar && oldUser.avatar.startsWith('/public/uploads/avatar/')) {
      const oldPath = path.join(app.baseDir, 'app', oldUser.avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    /* 查询更新后的用户信息 */
    const user = await ctx.model.User.findOne({
      where: { id: userId },
      attributes: { exclude: ['password'] },
      raw: true,
    });

    return ctx.service.api.auth._formatUserInfo(user);
  }

  /**
   * 获取用户VIP会员信息
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} VIP信息
   */
  async getVipInfo(userId) {
    const { ctx } = this;
    const user = await ctx.model.User.findOne({
      attributes: ['id', 'vip_tier_id', 'vip_expires_at'],
      where: { id: userId },
      raw: true,
    });
    if (!user) throw new Error('用户不存在');

    const membership = await ctx.service.api.membership.getMembershipByUser(user);
    const isExpired = !!user.vip_tier_id && !!user.vip_expires_at && dayjs().isAfter(dayjs(user.vip_expires_at));

    return {
      isVip: membership.is_vip,
      tierCode: membership.tier_code || null,
      tierName: membership.level_name || null,
      expiresAt: user.vip_expires_at ? dayjs(user.vip_expires_at).format('YYYY-MM-DD HH:mm:ss') : null,
      isExpired,
      sortOrder: Number(membership.level_rank || 0),
      membershipLevel: membership.level || 'free',
      createLimit: Number(membership.create_limit || 0),
      novelWordLimit: Number(membership.novel_word_limit || 0),
    };
  }
}

module.exports = UserService;
