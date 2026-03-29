'use strict';

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

/**
 * 剧本导出服务（C端）
 * 生成 Word 文档并推送到 OSS 返回下载 URL
 */
class ScriptExportService extends Service {

  /**
   * 导出 Word 文档
   * @param {Object} params
   * @param {number} params.scriptId - 剧本ID
   * @param {number} params.userId - 用户ID
   * @param {string} params.taskId - 任务ID
   * @param {Object} params.taskStatus - 任务状态对象
   * @param {Function} params.sendEvent - 发送 SSE 事件的函数
   */
  async exportWord({ scriptId, userId, mode = 'script', taskId, taskStatus, sendEvent }) {
    const { app } = this;

    const exportPayload = mode === 'novel'
      ? await this._buildNovelExportPayload(scriptId, userId, sendEvent)
      : await this._buildScriptExportPayload(scriptId, userId, sendEvent);

    /* 3. 构建 Word 文档内容 */
    const docChildren = [];

    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: exportPayload.title || '未命名剧本',
            bold: true,
            size: 60,
          }),
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
      })
    );

    for (const section of exportPayload.sections) {
      if (!section.content) continue;
      if (section.progress && section.message) {
        sendEvent('progress', { percent: section.progress, message: section.message });
      }
      this._pushSection(docChildren, section.title, section.content);
    }

    /* 3.7 分集内容（按弹窗展示结构生成） */
    sendEvent('progress', { percent: 55, message: '整理分集内容...' });

    if (exportPayload.episodes && exportPayload.episodes.length > 0) {
      const totalEpisodes = exportPayload.episodes.length;
      for (let i = 0; i < exportPayload.episodes.length; i++) {
        const ep = exportPayload.episodes[i];

        if (taskStatus.cancelled) {
          throw new Error('用户取消');
        }

        const progress = 55 + Math.floor(((i + 1) / totalEpisodes) * 40);
        sendEvent('progress', {
          percent: Math.min(progress, 95),
          message: `整理第${i + 1}/${totalEpisodes}集...`,
        });

        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `第${ep.episodeNumber}集：${ep.title || '未命名'}`,
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '大纲：',
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        this._pushMultilineContent(docChildren, this._stripEpisodeTitle(ep.outline) || '暂无大纲', { after: 200 });

        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '剧本：',
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 100 },
          })
        );
        this._pushMultilineContent(docChildren, this._stripEpisodeTitle(ep.scriptContent) || '暂无剧本', { after: 300 });
      }
    }

    /* 4. 生成 Word 文件 */
    sendEvent('progress', { percent: 96, message: '生成 Word 文档...' });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    /* 生成 buffer */
    const buffer = await Packer.toBuffer(doc);

    /* 5. 保存到临时目录 */
    const tempDir = path.join(app.config.baseDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `script_export_${taskId}.docx`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, buffer);

    /* 记录文件路径，供取消时删除 */
    taskStatus.filePath = filePath;

    /* 6. 这里简化处理：直接返回本地临时文件路径
     * 生产环境应该上传到 OSS（如阿里云 OSS），然后返回 OSS URL
     * 下面的 downloadUrl 处理是演示逻辑，实际需要配置 OSS */
    sendEvent('progress', { percent: 98, message: '准备下载...' });

    /* 方案A：返回本地文件 URL（仅适合本地开发测试） */
    const downloadUrl = `/api/script-export/download/${taskId}`;

    /* 方案B（推荐）：上传到 OSS，返回 OSS URL
     * TODO: 接入 OSS 后取消注释下面代码
     */
    // const ossUrl = await this.uploadToOSS(filePath, fileName);
    // const downloadUrl = ossUrl;
    // /* 上传成功后删除本地临时文件 */
    // if (fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);
    // }

    return { downloadUrl };
  }

  async _buildScriptExportPayload(scriptId, userId, sendEvent) {
    const { ctx } = this;

    sendEvent('progress', { percent: 5, message: '读取剧本信息...' });

    const script = await ctx.model.Script.findOne({
      where: { id: scriptId, user_id: userId },
      raw: true,
    });

    if (!script) {
      throw new Error('剧本不存在或无权访问');
    }

    sendEvent('progress', { percent: 10, message: '读取分集内容...' });

    const episodes = await ctx.model.ScriptEpisode.findAll({
      where: { script_id: scriptId, user_id: userId },
      order: [['episode_number', 'ASC']],
      raw: true,
    });

    return {
      title: script.title || '未命名剧本',
      sections: [
        { title: '基本信息', content: script.basic_info, progress: 25, message: '整理基本信息...' },
        { title: '剧情梗概', content: script.synopsis, progress: 35, message: '整理剧情梗概...' },
        { title: '人物介绍', content: script.characters, progress: 45, message: '整理人物介绍...' },
        { title: '信息流情绪点', content: script.emotion_points },
        { title: '剧情线', content: script.plot_lines },
      ],
      episodes: (episodes || []).map(ep => ({
        episodeNumber: ep.episode_number,
        title: ep.title,
        outline: ep.content,
        scriptContent: ep.script_content,
      })),
    };
  }

  async _buildNovelExportPayload(projectId, userId, sendEvent) {
    const { ctx } = this;

    sendEvent('progress', { percent: 5, message: '读取小说转剧本项目...' });

    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId, user_id: userId },
      raw: true,
    });

    if (!project) {
      throw new Error('小说项目不存在或无权访问');
    }

    sendEvent('progress', { percent: 10, message: '读取故事线与分集内容...' });

    const [ storyline, episodes ] = await Promise.all([
      ctx.model.NovelStoryline.findOne({
        where: { novel_project_id: projectId, user_id: userId },
        raw: true,
      }),
      ctx.model.NovelEpisode.findAll({
        where: { novel_project_id: projectId, user_id: userId },
        order: [['episode_number', 'ASC']],
        raw: true,
      }),
    ]);

    return {
      title: project.title || '未命名剧本',
      sections: [
        { title: '故事线', content: storyline?.content, progress: 25, message: '整理故事线...' },
      ],
      episodes: (episodes || []).map(ep => ({
        episodeNumber: ep.episode_number,
        title: ep.title,
        outline: ep.outline,
        scriptContent: ep.script_content,
      })),
    };
  }

  _pushSection(docChildren, title, content) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32,
            color: '2563EB',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    this._pushMultilineContent(docChildren, content, { after: 300 });
  }

  _pushMultilineContent(docChildren, content, options = {}) {
    const { size = 24, after = 200 } = options;
    const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');

    lines.forEach((line, index) => {
      const isLastLine = index === lines.length - 1;
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || ' ',
              size,
            }),
          ],
          spacing: { after: isLastLine ? after : 80 },
        })
      );
    });
  }

  _stripEpisodeTitle(text) {
    if (!text) return '';
    const lines = String(text).split('\n');
    if (/^第[0-9一二三四五六七八九十百千]+集/.test(lines[0].trim())) {
      return lines.slice(1).join('\n').trim();
    }
    return String(text).trim();
  }

  /**
   * 下载导出的文件
   * GET /api/script-export/download/:taskId
   */
  async downloadFile(taskId) {
    const { app } = this;
    const tasks = app.scriptExportTasks || {};
    const task = Object.values(tasks).find(t => t.filePath && t.filePath.includes(taskId));

    if (!task || !task.filePath || !fs.existsSync(task.filePath)) {
      return null;
    }

    return task.filePath;
  }
}

module.exports = ScriptExportService;
