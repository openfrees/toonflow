'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 文件上传控制器
 * 处理图片上传等文件上传功能
 */
class UploadController extends Controller {

  /**
   * POST /api/upload/image - 上传图片
   * 支持反馈截图、头像等图片上传
   */
  async uploadImage() {
    const { ctx } = this;

    try {
      /* 获取上传的文件 */
      const file = ctx.request.files[0];

      if (!file) {
        ctx.body = ctx.helper.fail('请选择要上传的图片');
        return;
      }

      /* 验证文件大小（2MB），egg-multipart file模式需通过fs获取 */
      const maxSize = 2 * 1024 * 1024;
      const fileStat = fs.statSync(file.filepath);
      if (fileStat.size > maxSize) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('图片大小不能超过2MB');
        return;
      }

      /* 验证文件类型（egg-multipart file模式属性名为mime） */
      const allowedMimeTypes = ['image/jpeg', 'image/png'];
      if (!allowedMimeTypes.includes(file.mime)) {
        fs.unlinkSync(file.filepath);
        ctx.body = ctx.helper.fail('只支持jpg、png格式的图片');
        return;
      }

      /* 获取文件扩展名 */
      const ext = path.extname(file.filename).toLowerCase();

      /* 生成唯一文件名：UUID + 时间戳 */
      const uniqueFilename = `${uuidv4()}_${Date.now()}${ext}`;

      /* 按日期分目录存储：YYYYMMDD */
      const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uploadDir = path.join(this.app.baseDir, 'app/public/uploads/feedback', dateDir);

      /* 确保目录存在 */
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      /* 目标文件路径 */
      const targetPath = path.join(uploadDir, uniqueFilename);

      /* 移动文件到目标位置（用 copy+delete 代替 rename，避免 Linux 跨分区 EXDEV 错误） */
      fs.copyFileSync(file.filepath, targetPath);
      fs.unlinkSync(file.filepath);

      /* 返回可访问的URL路径 */
      const url = `/public/uploads/feedback/${dateDir}/${uniqueFilename}`;

      ctx.body = ctx.helper.success({ url }, '上传成功');

    } catch (err) {
      ctx.body = ctx.helper.fail('上传失败，请稍后重试');
    }
  }
}

module.exports = UploadController;
