'use strict';

/**
 * 小说 Agent 调度服务
 * 完全对标 Toonflow OutlineScript 的核心调用模式：
 * - 工具用 tool() + Zod schema + execute 定义
 * - 单次 aiStream() 调用，SDK 自动执行工具循环
 * - 子 Agent 通过 createSubAgentTool() 创建为主 Agent 的工具
 */

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');
const { aiStream } = require('../../lib/ai_chat');
const { tool } = require('ai');
const z = require('zod');

// ==================== 提示词加载器 ====================

const loadPrompt = (name) => {
  const map = {
    main_agent: '../../prompts/主AGENT/大纲故事线Agent.txt',
    story_analyst: '../../prompts/子Agent/大纲故事线Agent-故事师.txt',
    outline_writer: '../../prompts/子Agent/大纲故事线Agent-大纲师.txt',
    planner: '../../prompts/子Agent/大纲故事线Agent-规划师.txt',
    director: '../../prompts/子Agent/大纲故事线Agent-导演.txt',
  };
  const rel = map[name] || `../../prompts/novel_agent/${name}.txt`;
  return fs.readFileSync(path.join(__dirname, rel), 'utf-8');
};

// ==================== Zod Schema（照抄 Toonflow index.ts:37-67）====================

const sceneItemSchema = z.object({
  name: z.string().describe('场景名称，如"五星酒店宴会厅"、"老旧出租屋"'),
  description: z.string().describe('环境描写：空间结构、光线氛围、装饰陈设、环境细节'),
});

const characterItemSchema = z.object({
  name: z.string().describe('角色姓名（必须是具体人名，禁止"众人"、"群众"等集合描述）'),
  description: z.string().describe('人设样貌：年龄体态、五官特征、发型妆容、服装配饰、气质神态'),
});

const propItemSchema = z.object({
  name: z.string().describe('道具名称'),
  description: z.string().describe('样式描写：材质质感、颜色图案、形状尺寸、磨损痕迹、特殊标记'),
});

const episodeSchema = z.object({
  episodeIndex: z.number().describe('集数索引，从1开始递增'),
  title: z.string().describe('8字内标题，疑问/感叹句，含情绪爆点'),
  episodeDuration: z.number().optional().describe('单集时长（分钟），不传则继承项目设置时长'),
  chapterRange: z.array(z.number()).describe('关联章节号数组'),
  scenes: z.array(sceneItemSchema).describe('场景列表，按 outline 出场顺序排列'),
  characters: z.array(characterItemSchema).describe('角色列表，按 outline 出场顺序排列，必须是独立个体'),
  props: z.array(propItemSchema).describe('道具列表，按 outline 出场顺序排列，至少3个'),
  coreConflict: z.string().describe('核心矛盾：A想要X vs B阻碍X'),
  outline: z.string().describe('100-300字剧情主干，最高优先级，剧本生成的唯一权威，按时间顺序完整叙述'),
  openingHook: z.string().describe('开场镜头：outline 第一句话的视觉化，必须作为剧本第一个镜头'),
  keyEvents: z.array(z.string()).length(4).describe('4个元素的数组：[起, 承, 转, 合]，严格按 outline 顺序从中提取'),
  emotionalCurve: z.string().describe('情绪曲线，如：2(压抑)→5(反抗)→9(爆发)→3(余波)，对应 keyEvents 各阶段'),
  visualHighlights: z.array(z.string()).describe('3-5个标志性镜头，按 outline 叙事顺序排列'),
  endingHook: z.string().describe('结尾悬念：outline 之后的延伸，勾引下集'),
  classicQuotes: z.array(z.string()).describe('1-2句金句，每句≤15字，必须从原文提取'),
});

// ==================== 常量配置 ====================

const TOOL_TITLE_MAP = {
  getChapter: '正在获取章节内容',
  getChapterList: '正在获取章节列表',
  getStoryline: '正在获取故事线',
  getStorylineCoverage: '正在获取故事线覆盖进度',
  saveStoryline: '正在保存故事线',
  deleteStoryline: '正在删除故事线',
  getOutline: '正在获取大纲',
  getOutlineCoverage: '正在获取大纲覆盖进度',
  saveOutline: '正在保存大纲',
  updateOutline: '正在更新大纲',
  deleteOutline: '正在删除大纲',
  generateAssets: '正在生成资产',
  insertEpisodeOutline: '正在保存指定集大纲',
  getEpisodePlan: '正在获取分集规划表',
  saveEpisodePlan: '正在保存分集规划表',
};

const SUB_AGENT_MAP = {
  AI1: { type: 'AI1', name: '故事师', prompt: 'story_analyst' },
  planner: { type: 'planner', name: '规划师', prompt: 'planner' },
  AI2: { type: 'AI2', name: '大纲师', prompt: 'outline_writer' },
  director: { type: 'director', name: '导演', prompt: 'director' },
};

const REFRESH_MAP = {
  saveStoryline: 'storyline',
  deleteStoryline: 'storyline',
  saveOutline: 'outline',
  updateOutline: 'outline',
  insertEpisodeOutline: 'outline',
  deleteOutline: 'outline',
  saveEpisodePlan: 'episodePlan',
};

/* 保存类工具名单：完成任意一个即视为「最小可用单元已交付」，积分不足时可安全中断 */
const SAVE_TOOLS = new Set(['saveStoryline', 'saveOutline', 'updateOutline', 'insertEpisodeOutline']);

// ==================== Service 类 ====================

class NovelAgentService extends Service {

  // ==================== 工具定义（对标 Toonflow index.ts:398-537）====================

  /**
   * 创建子 Agent 调度工具（对标 Toonflow createSubAgentTool :664-672）
   */
  _createSubAgentTool(agentType, description, projectId, userId, res, abortSignal) {
    const self = this;
    return tool({
      description,
      inputSchema: z.object({
        taskDescription: z.string().describe('交给该角色的任务描述'),
      }),
      execute: async ({ taskDescription }) => {
        try {
          return await self.invokeSubAgent(agentType, taskDescription, projectId, userId, res, abortSignal);
        } catch (err) {
          console.error(`[NovelAgent] 子Agent ${agentType} 执行失败:`, err.message);
          self._sseWrite(res, { type: 'subAgentEnd', agent: SUB_AGENT_MAP[agentType]?.name || agentType });
          return `${agentType}执行失败: ${err.message}`;
        }
      },
    });
  }

  /**
   * 获取主 Agent 全部工具（对标 Toonflow getAllTools :677-692）
   * 仅保留：子Agent调度 + 高危删除 + 资产生成
   */
  _getAllTools(projectId, userId, res, abortSignal) {
    const tools = this.ctx.service.api.novelAgentTools;
    const self = this;

    return {
      // 子 Agent 调度工具
      AI1: this._createSubAgentTool('AI1', '调用故事师。负责分析小说原文并生成故事线，会自行调用 saveStoryline 保存结果。', projectId, userId, res, abortSignal),
      planner: this._createSubAgentTool('planner', '调用规划师。负责在大纲生成前制定分集规划表（决定每集覆盖哪些章节），会自行调用 saveEpisodePlan 保存。必须在故事线完成后、大纲生成前调用。', projectId, userId, res, abortSignal),
      AI2: this._createSubAgentTool('AI2', '调用大纲师。负责根据故事线和分集规划表生成剧集大纲，会自行调用 saveOutline 保存结果。', projectId, userId, res, abortSignal),
      director: this._createSubAgentTool('director', '调用导演。负责审核故事线和大纲的质量，会自行调用 updateOutline 或 saveStoryline 进行修改。', projectId, userId, res, abortSignal),

      deleteStoryline: tool({
        description: '删除当前项目的故事线',
        inputSchema: z.object({}),
        execute: async () => {
          self._sseWrite(res, { type: 'toolCall', tool: 'deleteStoryline', toolTitle: TOOL_TITLE_MAP.deleteStoryline, status: 'calling' });
          const result = await tools.deleteStoryline(projectId);
          self._sseWrite(res, { type: 'toolCall', tool: 'deleteStoryline', toolTitle: TOOL_TITLE_MAP.deleteStoryline, status: 'success' });
          self._sseWrite(res, { type: 'refresh', target: 'storyline' });
          return result;
        },
      }),

      // 大纲工具
      getOutline: tool({
        description: '获取项目大纲。simplified=true返回简化列表，false返回完整内容。可通过episodeNumber精确获取某一集',
        inputSchema: z.object({
          simplified: z.boolean().default(false).describe('是否返回简化版本'),
          episodeNumber: z.number().optional().describe('指定集数，只返回该集大纲'),
        }),
        execute: async ({ simplified, episodeNumber }) => {
          self._sseWrite(res, { type: 'toolCall', tool: 'getOutline', toolTitle: TOOL_TITLE_MAP.getOutline, status: 'calling' });
          const result = simplified
            ? await tools.getOutlineSimplified(projectId)
            : await tools.getOutline(projectId, episodeNumber);
          self._sseWrite(res, { type: 'toolCall', tool: 'getOutline', toolTitle: TOOL_TITLE_MAP.getOutline, status: 'success' });
          return result;
        },
      }),

      deleteOutline: tool({
        description: '根据大纲ID删除指定大纲及关联数据',
        inputSchema: z.object({
          ids: z.array(z.number()).min(1).describe('要删除的大纲ID数组'),
        }),
        execute: async ({ ids }) => {
          self._sseWrite(res, { type: 'toolCall', tool: 'deleteOutline', toolTitle: TOOL_TITLE_MAP.deleteOutline, status: 'calling' });
          const result = await tools.deleteOutline(projectId, ids);
          self._sseWrite(res, { type: 'toolCall', tool: 'deleteOutline', toolTitle: TOOL_TITLE_MAP.deleteOutline, status: 'success' });
          self._sseWrite(res, { type: 'refresh', target: 'outline' });
          return result;
        },
      }),

      // 资产工具
      generateAssets: tool({
        description: '从当前项目的所有大纲中提取并生成角色、道具、场景资产，自动去重并清理冗余',
        inputSchema: z.object({}),
        execute: async () => {
          self._sseWrite(res, { type: 'toolCall', tool: 'generateAssets', toolTitle: TOOL_TITLE_MAP.generateAssets, status: 'calling' });
          const result = await tools.generateAssets(projectId);
          self._sseWrite(res, { type: 'toolCall', tool: 'generateAssets', toolTitle: TOOL_TITLE_MAP.generateAssets, status: 'success' });
          return result;
        },
      }),
    };
  }

  /**
   * 获取子 Agent 工具集（对标 Toonflow getSubAgentTools :595-603）
   * 子 Agent 只有读写权限，没有删除权限
   */
  _getSubAgentTools(projectId, userId, res, hooks = {}) {
    const tools = this.ctx.service.api.novelAgentTools;
    const self = this;

    return {
      getChapterList: tool({
        description: '获取小说章节列表（标题+字数，不含正文）',
        inputSchema: z.object({}),
        execute: async () => {
          self._sseWrite(res, { type: 'toolCall', tool: 'getChapterList', toolTitle: TOOL_TITLE_MAP.getChapterList, status: 'calling' });
          const result = await tools.getChapterList(projectId);
          self._sseWrite(res, { type: 'toolCall', tool: 'getChapterList', toolTitle: TOOL_TITLE_MAP.getChapterList, status: 'success' });
          return result;
        },
      }),

      getChapter: tool({
        description: '根据章节编号获取小说章节的完整原文内容，支持批量获取',
        inputSchema: z.object({
          chapterNumbers: z.array(z.number()).describe('章节编号数组'),
        }),
        execute: async ({ chapterNumbers }) => {
          self._sseWrite(res, { type: 'toolCall', tool: 'getChapter', toolTitle: TOOL_TITLE_MAP.getChapter, status: 'calling' });
          const result = await tools.getChapter(projectId, chapterNumbers);
          self._sseWrite(res, { type: 'toolCall', tool: 'getChapter', toolTitle: TOOL_TITLE_MAP.getChapter, status: 'success' });
          return result;
        },
      }),

      getStoryline: tool({
        description: '获取当前项目已保存的故事线内容',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await tools.getStoryline(projectId);
          return result;
        },
      }),

      getStorylineCoverage: tool({
        description: '获取故事线覆盖进度（是否覆盖到全部已选择章节）',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await tools.getStorylineCoverage(projectId);
          return JSON.stringify(result);
        },
      }),

      saveStoryline: tool({
        description: '保存或更新当前项目的故事线，会覆盖已有内容',
        inputSchema: z.object({
          content: z.string().describe('故事线完整内容'),
        }),
        execute: async ({ content }) => {
          self._sseWrite(res, { type: 'toolCall', tool: 'saveStoryline', toolTitle: TOOL_TITLE_MAP.saveStoryline, status: 'calling' });
          const result = await tools.saveStoryline(projectId, userId, content);
          const failed = typeof result === 'string' && (/^未执行保存/.test(result) || /无法/.test(result));
          if (!failed && typeof hooks.onToolCall === 'function') hooks.onToolCall('saveStoryline');
          self._sseWrite(res, {
            type: 'toolCall',
            tool: 'saveStoryline',
            toolTitle: TOOL_TITLE_MAP.saveStoryline,
            status: failed ? 'error' : 'success',
            message: failed ? result : undefined,
          });
          if (!failed) self._sseWrite(res, { type: 'refresh', target: 'storyline' });
          return result;
        },
      }),

      getOutline: tool({
        description: '获取项目大纲。simplified=true返回简化列表，false返回完整内容。可通过episodeNumber精确获取某一集（推荐审核/修改特定集时使用，避免长列表混淆）',
        inputSchema: z.object({
          simplified: z.boolean().default(false).describe('是否返回简化版本'),
          episodeNumber: z.number().optional().describe('指定集数（如16），只返回该集大纲。审核或修改特定集时强烈建议使用此参数'),
        }),
        execute: async ({ simplified, episodeNumber }) => {
          if (simplified) {
            return await tools.getOutlineSimplified(projectId);
          }
          return await tools.getOutline(projectId, episodeNumber);
        },
      }),

      getOutlineCoverage: tool({
        description: '获取当前大纲章节覆盖进度（基于数据库 chapterRange）',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await tools.getOutlineCoverage(projectId);
          return JSON.stringify(result);
        },
      }),

      saveOutline: tool({
        description: '保存大纲数据（单次仅允许1集）。overwrite=true会清空现有大纲后写入，false则追加到末尾',
        inputSchema: z.object({
          episodes: z.array(episodeSchema).min(1).max(1).describe('大纲数据数组（单次仅1集，需逐集调用）'),
          overwrite: z.boolean().optional().describe('是否覆盖现有大纲；已有大纲时必须明确传 true/false'),
          startEpisode: z.number().optional().describe('追加模式下的起始集数'),
        }),
        execute: async ({ episodes, overwrite, startEpisode }) => {
          self._sseWrite(res, { type: 'toolCall', tool: 'saveOutline', toolTitle: TOOL_TITLE_MAP.saveOutline, status: 'calling' });
          const result = await tools.saveOutline(projectId, userId, episodes, overwrite, startEpisode);
          const failed = typeof result === 'string' && /^未执行保存/.test(result);
          if (!failed && typeof hooks.onToolCall === 'function') hooks.onToolCall('saveOutline');
          self._sseWrite(res, {
            type: 'toolCall',
            tool: 'saveOutline',
            toolTitle: TOOL_TITLE_MAP.saveOutline,
            status: failed ? 'error' : 'success',
            message: failed ? result : undefined,
          });
          if (!failed) self._sseWrite(res, { type: 'refresh', target: 'outline' });
          return result;
        },
      }),

      updateOutline: tool({
        description: '更新单集大纲内容（需要已有大纲ID）',
        inputSchema: z.object({
          id: z.number().describe('大纲ID'),
          data: episodeSchema.partial().describe('更新后的大纲数据'),
        }),
        execute: async ({ id, data }) => {
          if (typeof hooks.onToolCall === 'function') hooks.onToolCall('updateOutline');
          self._sseWrite(res, { type: 'toolCall', tool: 'updateOutline', toolTitle: TOOL_TITLE_MAP.updateOutline, status: 'calling' });
          const result = await tools.updateOutlineById(projectId, id, data);
          self._sseWrite(res, { type: 'toolCall', tool: 'updateOutline', toolTitle: TOOL_TITLE_MAP.updateOutline, status: 'success' });
          self._sseWrite(res, { type: 'refresh', target: 'outline' });
          return result;
        },
      }),

      insertEpisodeOutline: tool({
        description: '在指定集数位置插入或替换大纲。用于"重新生成第X集"场景，不受连续性检查限制。如果该集已存在则更新，不存在则创建',
        inputSchema: z.object({
          episodeNumber: z.number().describe('目标集数（如2表示第2集）'),
          data: episodeSchema.describe('完整的大纲数据'),
        }),
        execute: async ({ episodeNumber, data }) => {
          if (typeof hooks.onToolCall === 'function') hooks.onToolCall('insertEpisodeOutline');
          self._sseWrite(res, { type: 'toolCall', tool: 'insertEpisodeOutline', toolTitle: `正在保存第${episodeNumber}集大纲`, status: 'calling' });
          const result = await tools.insertEpisodeOutline(projectId, userId, episodeNumber, data);
          const failed = typeof result === 'string' && /^未执行保存/.test(result);
          self._sseWrite(res, {
            type: 'toolCall', tool: 'insertEpisodeOutline',
            toolTitle: `正在保存第${episodeNumber}集大纲`,
            status: failed ? 'error' : 'success',
            message: failed ? result : undefined,
          });
          if (!failed) self._sseWrite(res, { type: 'refresh', target: 'outline' });
          return result;
        },
      }),

      // ==================== 分集规划表工具 ====================

      getEpisodePlan: tool({
        description: '获取当前项目的分集规划表（规划师生成的章节-集数映射）',
        inputSchema: z.object({}),
        execute: async () => {
          self._sseWrite(res, { type: 'toolCall', tool: 'getEpisodePlan', toolTitle: TOOL_TITLE_MAP.getEpisodePlan, status: 'calling' });
          const result = await tools.getEpisodePlan(projectId);
          self._sseWrite(res, { type: 'toolCall', tool: 'getEpisodePlan', toolTitle: TOOL_TITLE_MAP.getEpisodePlan, status: 'success' });
          return result;
        },
      }),

      saveEpisodePlan: tool({
        description: '保存分集规划表。规划师专用，决定每集覆盖哪些章节',
        inputSchema: z.object({
          plan: z.array(z.object({
            episode: z.number().describe('集数，从1开始'),
            chapters: z.array(z.number()).describe('该集覆盖的章节号数组'),
            summary: z.string().describe('该集的简要说明'),
          })).describe('分集规划数组'),
        }),
        execute: async ({ plan }) => {
          if (typeof hooks.onToolCall === 'function') hooks.onToolCall('saveEpisodePlan');
          self._sseWrite(res, { type: 'toolCall', tool: 'saveEpisodePlan', toolTitle: TOOL_TITLE_MAP.saveEpisodePlan, status: 'calling' });
          const result = await tools.saveEpisodePlan(projectId, plan);
          const failed = typeof result === 'string' && /^未执行保存/.test(result);
          self._sseWrite(res, {
            type: 'toolCall', tool: 'saveEpisodePlan',
            toolTitle: TOOL_TITLE_MAP.saveEpisodePlan,
            status: failed ? 'error' : 'success',
            message: failed ? result : undefined,
          });
          if (!failed) self._sseWrite(res, { type: 'refresh', target: 'episodePlan' });
          return result;
        },
      }),
    };
  }

  // ==================== 上下文构建 ====================

  /**
   * 构建环境上下文（对标 Toonflow buildEnvironmentContext :546-571）
   */
  async buildEnvironmentContext(projectId) {
    const { ctx } = this;
    const tools = ctx.service.api.novelAgentTools;
    const parts = [];

    /* 项目基本信息 */
    const project = await ctx.model.NovelProject.findOne({
      where: { id: projectId },
      attributes: ['title', 'total_episodes', 'duration', 'gender', 'genres'],
      raw: true,
    });
    if (project) {
      const genres = ctx.helper.parseJsonArray(project.genres, []);
      const totalChapters = await ctx.model.NovelChapter.count({
        where: { novel_project_id: projectId, is_selected: 1 },
      });
      const totalEpisodes = Number(project.total_episodes) || 0;
      const chaptersPerEpisode = totalChapters > 0 && totalEpisodes > 0
        ? (totalChapters / totalEpisodes).toFixed(1)
        : null;
      const suggestedPerEp = chaptersPerEpisode ? Math.max(1, Math.round(Number(chaptersPerEpisode))) : 0;
      let suggestRange = '未知';
      if (chaptersPerEpisode) {
        const ratio = Number(chaptersPerEpisode);
        if (ratio >= 2) {
          suggestRange = `每集约${suggestedPerEp}章（${totalChapters}÷${totalEpisodes}≈${chaptersPerEpisode}）。⚠️ 这是强制要求，每集必须覆盖约${suggestedPerEp}章原文，禁止1章=1集的拆分`;
        } else {
          suggestRange = `每集约${suggestedPerEp}章（${totalChapters}章÷${totalEpisodes}集≈${chaptersPerEpisode}）。⚠️ 章节数接近集数，必须严格每集只覆盖${suggestedPerEp}章，绝对禁止一集吃掉多章！多拿1章都会导致后续章节不够用`;
        }
      }

      const meta = [
        `项目名称: ${project.title || '未命名'}`,
        `目标总集数: ${totalEpisodes || '未设置'}`,
        `单集时长: ${project.duration || '未设置'}分钟`,
        `总章节数: ${totalChapters || '未知'}`,
        `建议每集章节数: ${suggestRange}`,
        `频道: ${project.gender || '未设置'}`,
      ];
      if (genres.length) {
        meta.push(`题材: ${genres.join('、')}`);
      }
      parts.push(`## 项目信息\n${meta.join('\n')}`);
    }

    /* 章节列表 */
    const chapterList = await tools.getChapterList(projectId);
    parts.push(`## 小说章节\n${chapterList}`);

    /* 故事线现状 */
    const storyline = await tools.getStoryline(projectId);
    if (storyline && !storyline.includes('还没有故事线')) {
      const preview = storyline.length > 500 ? storyline.slice(0, 500) + '...' : storyline;
      parts.push(`## 当前故事线（摘要）\n${preview}`);
    }

    /* 分集规划表 */
    const episodePlan = await tools.getEpisodePlan(projectId);
    if (episodePlan && !episodePlan.includes('还没有分集规划表')) {
      const preview = episodePlan.length > 800 ? episodePlan.slice(0, 800) + '...' : episodePlan;
      parts.push(`## 分集规划表\n${preview}`);
    }

    /* 大纲现状 */
    const outline = await tools.getOutline(projectId);
    if (outline && !outline.includes('还没有分集大纲')) {
      const preview = outline.length > 500 ? outline.slice(0, 500) + '...' : outline;
      parts.push(`## 当前大纲（摘要）\n${preview}`);
    }

    return parts.join('\n\n');
  }

  /**
   * 构建完整上下文（对标 Toonflow buildFullContext :578-591）
   * 用于子 Agent，包含环境信息 + 对话历史 + 当前任务
   */
  async buildFullContext(projectId, task, chatHistory = '') {
    const env = await this.buildEnvironmentContext(projectId);

    return `${env}

<对话历史>
${chatHistory || '无对话历史'}
</对话历史>

<当前任务>
${task}
</当前任务>`;
  }

  // ==================== 子 Agent（对标 Toonflow invokeSubAgent :609-662）====================

  /**
   * 调用子 Agent（故事师/大纲师/导演）
   * 与 Toonflow 完全一致：单次 aiStream 调用，SDK 自动执行工具
   */
  async invokeSubAgent(agentType, task, projectId, userId, res, abortSignal) {
    const { ctx, app } = this;
    const agentConfig = SUB_AGENT_MAP[agentType];
    if (!agentConfig) return `未知的子Agent类型: ${agentType}`;

    this._lastAI1RunState = this._lastAI1RunState || {};
    const runKey = `${projectId}:${userId}`;

    if (agentType === 'director' && /(故事线|剧情线)/.test(String(task || ''))) {
      const lastRun = this._lastAI1RunState[runKey];
      if (lastRun && lastRun.saved === false) {
        return '检测到本轮故事线尚未成功保存，已阻止导演审核。请先让故事师完成完整生成并保存。';
      }

      const latestAI1 = await ctx.model.NovelChatHistory.findOne({
        where: { novel_project_id: projectId, user_id: userId, role: 'assistant', agent_type: 'AI1' },
        order: [[ 'created_at', 'DESC' ]],
        attributes: [ 'content' ],
        raw: true,
      });
      if (latestAI1?.content && latestAI1.content.includes('故事线输出疑似超过模型单次上限')) {
        return '检测到上一轮故事线尚未完整保存，已阻止导演审核。请先继续生成故事线并完成保存。';
      }
    }

    /* 发送 transfer 事件 — 对标 Toonflow emit("transfer") */
    this._sseWrite(res, { type: 'transfer', agent: agentConfig.name, title: `正在调用 ${agentConfig.name}` });
    this._sseWrite(res, {
      type: 'subAgentStatus', agent: agentConfig.name,
      status: 'invoking', message: `正在调用 ${agentConfig.name}`,
    });

    ctx.logger.info('[NovelAgent] 调用子Agent: %s, 任务: %s', agentConfig.name, task);

    const systemPrompt = loadPrompt(agentConfig.prompt);

    /* 构建对话历史摘要（最近用户消息） */
    const recentHistory = await this._getRecentUserMessages(projectId);

    /* 在子Agent任务中注入数据库真值约束，避免凭聊天语义推断章节 */
    const decoratedTask = await this._decorateTaskWithCoverage(agentType, task, projectId);

    /* 构建完整上下文（对标 Toonflow buildFullContext） */
    const context = await this.buildFullContext(projectId, decoratedTask, recentHistory);

    /* 发送思考状态 */
    this._sseWrite(res, {
      type: 'subAgentStatus', agent: agentConfig.name,
      status: 'thinking', message: `${agentConfig.name} 正在思考`,
    });

    /* 故事线已完成时，AI1 走单次执行（不走续写循环），避免完成后仍重复生成 */
    const useAI1Continuation = agentType === 'AI1' && !(await this._isStorylineComplete(projectId));

    /* 构建子Agent级别的积分预算检查回调 */
    const pointBudgetCheck = this._pointCallbacks?.checkBudget || null;

    const executionResult = useAI1Continuation
      ? await this._invokeStoryAnalystWithContinuation({
        agentConfig,
        systemPrompt,
        context,
        taskHint: task,
        projectId,
        userId,
        res,
        abortSignal,
        pointBudgetCheck,
      })
      : await this._runSubAgentSinglePass({
        agentConfig,
        systemPrompt,
        context,
        projectId,
        userId,
        res,
        abortSignal,
        pointBudgetCheck,
      });

    if (agentType === 'AI1') {
      this._lastAI1RunState[runKey] = {
        saved: executionResult.calledTools?.has('saveStoryline') || false,
        finishReason: executionResult.finishReason || '',
      };
    }

    const fullResponse = executionResult.fullResponse || '';
    const isConnectionFailed = ['ai-connection-failed', 'ai-api-exhausted', 'stream-error'].includes(executionResult.finishReason);

    this._sseWrite(res, {
      type: 'subAgentEnd', agent: agentConfig.name,
      title: isConnectionFailed ? agentConfig.name + '因AI连接中断而停止' : agentConfig.name + '已完成',
      refreshPanel: !isConnectionFailed,
    });

    /* AI 连接失败的回复不保存到 chat history，避免下次对话时"已分析但未保存"的碎片内容误导 AI */
    if (!isConnectionFailed && fullResponse) {
      await this.saveMessage(projectId, userId, 'assistant', fullResponse, agentConfig.type);
    } else if (isConnectionFailed) {
      ctx.logger.warn('[NovelAgent] AI连接失败，子Agent %s 的输出不保存到历史（避免污染上下文）', agentConfig.name);
    }

    ctx.logger.info('[NovelAgent] 子Agent完成: %s, 输出长度: %d, finishReason: %s', agentConfig.name, fullResponse.length, executionResult.finishReason);

    /* 积分回调：通知 controller 层本次子Agent的输出字数，由 controller 判断是否中断 */
    if (this._pointCallbacks?.onSubAgentComplete && fullResponse.length > 0) {
      const budgetResult = await this._pointCallbacks.onSubAgentComplete(fullResponse.length);
      if (budgetResult && !budgetResult.canContinue) {
        ctx.logger.info('[NovelAgent] 积分不足，子Agent %s 完成后中断后续调度', agentConfig.name);
      }
    }

    return fullResponse || agentConfig.name + '已完成任务';
  }

  async _runSubAgentSinglePass({ agentConfig, systemPrompt, context, projectId, userId, res, abortSignal, maxStep = 100, maxTokens = 8192, pointBudgetCheck = null }) {
    const { ctx, app } = this;
    const calledTools = new Set();
    const completedSaveTools = new Set();
    const MAX_AI_RETRY = 2;
    const BUDGET_CHECK_INTERVAL = 100;

    /* 积分预算状态 */
    let subAgentOutputChars = 0;
    let lastBudgetCheckLength = 0;
    let budgetExceeded = false;
    let budgetExhausted = false;

    /* 获取用户自定义模型配置，未配置则抛出异常由 controller 捕获 */
    const aiConfig = await this.ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'script_gen');
    if (!aiConfig) {
      throw new Error('MODEL_NOT_CONFIGURED');
    }

    /* 带重试的 AI API 调用（指数退避），解决模型侧网络抖动/超时 */
    let result;
    for (let attempt = 0; attempt <= MAX_AI_RETRY; attempt++) {
      if (abortSignal?.aborted) break;
      try {
        result = await aiStream(aiConfig, {
          system: systemPrompt,
          tools: this._getSubAgentTools(projectId, userId, res, {
            onToolCall: toolName => {
              calledTools.add(toolName);
              if (SAVE_TOOLS.has(toolName)) {
                completedSaveTools.add(toolName);
                /* 之前已检测到积分不足，现在完成了保底（至少保存了一次），标记可安全中断 */
                if (budgetExceeded) {
                  budgetExhausted = true;
                  ctx.logger.info('[NovelAgent] 积分不足但已完成保底保存(%s)，下一轮文本输出时将中断', toolName);
                }
              }
            },
          }),
          messages: [{ role: 'user', content: context }],
          maxStep,
          maxTokens,
          abortSignal,
        });
        break;
      } catch (err) {
        const errMsg = this._extractErrorMessage(err);
        if (this._isInsufficientBalanceError(err)) {
          return { fullResponse: `${agentConfig.name}启动失败(余额不足): ${errMsg}`, finishReason: 'provider-insufficient-balance', calledTools, budgetExhausted: false };
        }
        if (this._isContextTooLongError(err)) {
          ctx.logger.warn('[NovelAgent] 上下文超过模型限制，跳过重试直接进入续写: %s', errMsg);
          this._sseWrite(res, { type: 'subAgentStatus', agent: agentConfig.name, status: 'thinking', message: '上下文过长，正在精简后重新分析...' });
          return { fullResponse: '', finishReason: 'context-overflow', calledTools, budgetExhausted: false };
        }
        if (attempt < MAX_AI_RETRY) {
          const delay = (attempt + 1) * 3000;
          ctx.logger.warn('[NovelAgent] AI API 第%d次调用失败，%dms后重试: %s', attempt + 1, delay, errMsg);
          this._sseWrite(res, { type: 'subAgentStatus', agent: agentConfig.name, status: 'thinking', message: `AI连接异常，正在第${attempt + 2}次尝试...` });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        ctx.logger.error('[NovelAgent] AI API %d次重试全部失败: %s', MAX_AI_RETRY + 1, errMsg);
        return { fullResponse: `${agentConfig.name}启动失败(已重试${MAX_AI_RETRY}次): ${errMsg}`, finishReason: 'ai-api-exhausted', calledTools, budgetExhausted: false };
      }
    }
    if (!result) {
      return { fullResponse: `${agentConfig.name}被中断`, finishReason: 'aborted', calledTools, budgetExhausted: false };
    }

    /* 流式读取，同样带重试保护 */
    let fullResponse = '';
    let finishReason = '';
    try {
      for await (const chunk of result.fullStream) {
        /* 已完成保底且积分耗尽，安全中断 */
        if (budgetExhausted) {
          ctx.logger.info('[NovelAgent] 积分耗尽且已完成保底，中断子Agent %s 流式输出 (已输出%d字)', agentConfig.name, subAgentOutputChars);
          finishReason = 'budget-exhausted';
          break;
        }

        if (chunk.type === 'text-delta') {
          const delta = chunk.textDelta ?? chunk.text ?? '';
          if (!delta) continue;
          fullResponse += delta;
          subAgentOutputChars += delta.length;
          this._sseWrite(res, { type: 'subAgentText', agent: agentConfig.name, content: delta });

          /* 细粒度积分预算检查：每 BUDGET_CHECK_INTERVAL 字符检查一次 */
          if (pointBudgetCheck && !budgetExceeded && subAgentOutputChars - lastBudgetCheckLength >= BUDGET_CHECK_INTERVAL) {
            lastBudgetCheckLength = subAgentOutputChars;
            const budget = await pointBudgetCheck(subAgentOutputChars);
            if (!budget.canContinue) {
              budgetExceeded = true;
              ctx.logger.info('[NovelAgent] 子Agent %s 积分预算不足 - 已输出%d字, 预估消耗=%d, 余额=%d, 已完成保存=%d个',
                agentConfig.name, subAgentOutputChars, budget.estimatedCost, budget.balance, completedSaveTools.size);
              if (completedSaveTools.size > 0) {
                /* 已完成至少一次保存，可安全中断 */
                budgetExhausted = true;
                finishReason = 'budget-exhausted';
                break;
              }
              /* 未完成任何保存，继续执行直到完成保底（不再做后续积分检查，等 onToolCall 中标记） */
            }
          }
        } else if (chunk.type === 'tool-call') {
          if (chunk.toolName) calledTools.add(chunk.toolName);
          this._sseWrite(res, {
            type: 'toolCall', tool: chunk.toolName,
            toolTitle: TOOL_TITLE_MAP[chunk.toolName] || `正在执行: ${chunk.toolName}`,
            status: 'calling',
          });
        } else if (chunk.type === 'step-finish' || chunk.type === 'finish-step' || chunk.type === 'finish') {
          if (chunk.finishReason) finishReason = String(chunk.finishReason);
        }
      }
    } catch (err) {
      const errMsg = this._extractErrorMessage(err);
      ctx.logger.error('[NovelAgent] 子Agent %s 流式读取中断: %s', agentConfig.name, errMsg);
      if (this._isInsufficientBalanceError(err)) {
        finishReason = 'provider-insufficient-balance';
      } else {
        finishReason = finishReason || 'stream-error';
      }
    }

    return { fullResponse, finishReason, calledTools, budgetExhausted };
  }

  async _invokeStoryAnalystWithContinuation({ agentConfig, systemPrompt, context, taskHint, projectId, userId, res, abortSignal, pointBudgetCheck = null }) {
    const tools = this.ctx.service.api.novelAgentTools;
    const maxRetry = 3;
    const targetChapter = this._extractExplicitTaskMaxChapter(taskHint || '');

    let retry = 0;
    let currentContext = context;
    let mergedResponse = '';
    let coverageBefore = await tools.getStorylineCoverage(projectId);
    const initialCoveredChapter = Number(coverageBefore?.coveredMaxChapter || 0);
    const explicitFromStart = this._isFromStartStorylineTask(taskHint || '');
    const targetAlreadyCoveredAtStart = targetChapter > 0 && initialCoveredChapter >= targetChapter;
    const rebuildFromStart = explicitFromStart || targetAlreadyCoveredAtStart;
    let lastResult = { finishReason: '', calledTools: new Set() };
    let lastPassResponse = '';
    let repeatedPassCount = 0;
    let consecutiveApiFailures = 0;

    while (retry < maxRetry && !abortSignal?.aborted) {
      retry++;

      if (retry > 1) {
        this._sseWrite(res, {
          type: 'subAgentStatus',
          agent: agentConfig.name,
          status: 'thinking',
          message: `检测到输出可能超长，正在第${retry}次续写`,
        });
      }

      const result = await this._runSubAgentSinglePass({
        agentConfig,
        systemPrompt,
        context: currentContext,
        projectId,
        userId,
        res,
        abortSignal,
        maxStep: 40,
        maxTokens: 8192,
        pointBudgetCheck,
      });

      lastResult = result;

      /* 积分预算耗尽（已完成保底保存后被中断），停止续写循环 */
      if (result.budgetExhausted) {
        this.ctx.logger.info('[NovelAgent] 故事师积分预算耗尽，停止续写循环（已完成保底保存）');
        const passResponse = result.fullResponse || '';
        if (passResponse) {
          mergedResponse = mergedResponse ? `${mergedResponse}\n${passResponse}` : passResponse;
        }
        return {
          fullResponse: mergedResponse,
          finishReason: 'budget-exhausted',
          calledTools: result.calledTools,
        };
      }

      /* 不可恢复：余额不足 */
      if (result.finishReason === 'provider-insufficient-balance') {
        const balanceMsg = '\n\n[系统提示] 当前AI供应商余额不足（402: Insufficient Balance），已停止自动续写重试。请先充值或切换可用模型后再继续生成故事线。';
        this._sseWrite(res, { type: 'subAgentText', agent: agentConfig.name, content: balanceMsg });
        return {
          fullResponse: (result.fullResponse || '') + balanceMsg,
          finishReason: result.finishReason,
          calledTools: result.calledTools,
        };
      }

      /* 上下文超长：立即用精简上下文重建，不算失败次数 */
      if (result.finishReason === 'context-overflow') {
        this.ctx.logger.warn('[NovelAgent] 上下文超长(第%d轮)，用数据库进度重建精简上下文', retry);
        const latestCoverage = await tools.getStorylineCoverage(projectId);
        coverageBefore = latestCoverage;
        currentContext = this._buildStoryContinuationContext({
          coverage: latestCoverage, targetChapter, rebuildFromStart, strictMode: true,
        });
        continue;
      }

      /* AI API 彻底失败或流式读取中途断开 */
      const isApiFailure = ['ai-api-exhausted', 'aborted'].includes(result.finishReason);
      const isStreamError = result.finishReason === 'stream-error';

      if (isApiFailure || isStreamError) {
        consecutiveApiFailures++;
        this.ctx.logger.warn('[NovelAgent] AI连接失败(第%d/%d轮), reason=%s', retry, maxRetry, result.finishReason);

        if (retry < maxRetry) {
          const retryDelay = consecutiveApiFailures * 5000;
          this._sseWrite(res, {
            type: 'subAgentStatus', agent: agentConfig.name, status: 'thinking',
            message: `AI连接异常，${Math.round(retryDelay / 1000)}秒后自动重试（第${retry}/${maxRetry}轮）...`,
          });
          await new Promise(r => setTimeout(r, retryDelay));
          const latestCoverage = await tools.getStorylineCoverage(projectId);
          coverageBefore = latestCoverage;
          currentContext = this._buildStoryContinuationContext({
            coverage: latestCoverage, targetChapter, rebuildFromStart, strictMode: true,
          });
          continue;
        }

        /* 重试全部耗尽：发 recoveryHint 让前端引导用户重发指令 */
        const finalCoverage = await tools.getStorylineCoverage(projectId);
        const recoveryMsg = `\n\n[系统提示] AI连接多次中断，当前故事线已保存到第${finalCoverage.coveredMaxChapter}章。请发送"继续分析故事线"，系统会从第${finalCoverage.coveredMaxChapter}章之后自动续写。`;
        this._sseWrite(res, { type: 'subAgentText', agent: agentConfig.name, content: recoveryMsg });
        this._sseWrite(res, {
          type: 'recoveryHint',
          message: `AI连接异常，故事线已保存到第${finalCoverage.coveredMaxChapter}章`,
          suggestAction: '继续分析故事线',
          coveredChapter: finalCoverage.coveredMaxChapter,
        });
        return {
          fullResponse: (mergedResponse || '') + recoveryMsg,
          finishReason: 'ai-connection-failed',
          calledTools: result.calledTools || new Set(),
        };
      }

      /* 正常返回，重置连续失败计数 */
      consecutiveApiFailures = 0;

      const passResponse = result.fullResponse || '';
      const isRepeatedPass = this._isRepeatingPass(lastPassResponse, passResponse);
      repeatedPassCount = isRepeatedPass ? repeatedPassCount + 1 : 0;
      lastPassResponse = passResponse;

      if (passResponse && (!isRepeatedPass || retry === 1)) {
        mergedResponse = mergedResponse
          ? `${mergedResponse}\n${passResponse}`
          : passResponse;
      }

      const saveDone = result.calledTools?.has('saveStoryline');
      const coverageAfter = await tools.getStorylineCoverage(projectId);
      const progressed = coverageAfter.coveredMaxChapter > coverageBefore.coveredMaxChapter;
      const reachedTarget = !rebuildFromStart
        && targetChapter > 0
        && coverageAfter.coveredMaxChapter >= targetChapter
        && (saveDone || progressed || !targetAlreadyCoveredAtStart);
      const likelyTruncated = this._isLikelyTruncated(passResponse, result.finishReason || '');

      if (saveDone || reachedTarget) {
        return {
          fullResponse: mergedResponse,
          finishReason: result.finishReason,
          calledTools: result.calledTools,
        };
      }

      if (!likelyTruncated && progressed) {
        return {
          fullResponse: mergedResponse,
          finishReason: result.finishReason,
          calledTools: result.calledTools,
        };
      }

      if (!saveDone && !progressed && repeatedPassCount >= 1) {
        this._sseWrite(res, {
          type: 'subAgentStatus',
          agent: agentConfig.name,
          status: 'thinking',
          message: '检测到重复流程描述，已切换为强约束续写模式',
        });
      }

      coverageBefore = coverageAfter;
      currentContext = this._buildStoryContinuationContext({
        coverage: coverageAfter,
        targetChapter,
        rebuildFromStart,
        strictMode: !likelyTruncated || repeatedPassCount >= 1,
      });
    }

    /*续写轮次用完（正常超长截断），也发 recoveryHint 引导继续 */
    const exhaustedCoverage = await tools.getStorylineCoverage(projectId);
    const covChapter = exhaustedCoverage.coveredMaxChapter;
    const warning = '\n\n[系统提示] 故事线输出超过模型单次上限，当前已保存到第' + covChapter + '章。请继续发送"继续分析故事线"，系统会自动从已保存进度续写。';
    this._sseWrite(res, { type: 'subAgentText', agent: agentConfig.name, content: warning });
    this._sseWrite(res, {
      type: 'recoveryHint',
      message: '故事线已保存到第' + covChapter + '章',
      suggestAction: '继续分析故事线',
      coveredChapter: covChapter,
    });
    return {
      fullResponse: (mergedResponse || '') + warning,
      finishReason: lastResult.finishReason || 'continuation-exhausted',
      calledTools: lastResult.calledTools || new Set(),
    };
  }

  _buildStoryContinuationContext({ coverage, targetChapter, rebuildFromStart = false, strictMode = false }) {
    const coveredMaxChapter = Number(coverage?.coveredMaxChapter || 0);
    const selectedMaxChapter = Number(coverage?.selectedMaxChapter || 0);
    const nextStart = rebuildFromStart ? 1 : (coveredMaxChapter + 1);
    const hardUpper = targetChapter > 0
      ? (selectedMaxChapter > 0 ? Math.min(targetChapter, selectedMaxChapter) : targetChapter)
      : selectedMaxChapter;
    const nextEnd = hardUpper > 0
      ? Math.min(nextStart + 19, hardUpper)
      : (nextStart + 19);
    const targetLine = targetChapter > 0
      ? `目标至少覆盖到第${targetChapter}章。`
      : '目标是继续补足后续未覆盖章节。';

    const strictRules = strictMode
      ? [
        '4) 禁止重复输出“让我先获取/我来帮您”等流程说明；',
        `5) 本轮仅允许获取一次章节：getChapter([${nextStart}..${nextEnd}])；`,
        '6) 获取后直接输出该段故事线正文，并立即调用 saveStoryline。',
      ]
      : [];

    return [
      '【续写任务】上一轮故事线输出可能因长度限制中断，请继续未完成内容。',
      `当前数据库已保存故事线覆盖到第${coveredMaxChapter}章。`,
      targetLine,
      `本轮建议处理范围：第${nextStart}-${nextEnd}章。`,
      '要求：',
      '1) 从中断位置继续，不要重复已完成段落；',
      '2) 完成后必须调用 saveStoryline 覆盖保存最新完整故事线；',
      '3) 输出可分段，但不得在未保存前结束。',
      ...strictRules,
    ].join('\n');
  }

  _isFromStartStorylineTask(taskHint = '') {
    const text = String(taskHint || '');
    return /(从第\s*1\s*章开始|从头|重新分析|重做|重写|全部重建|重置故事线)/.test(text);
  }

  _isRepeatingPass(previousText = '', currentText = '') {
    const prev = this._normalizeTextForLoopCheck(previousText);
    const curr = this._normalizeTextForLoopCheck(currentText);
    if (!prev || !curr) return false;
    if (prev === curr) return true;
    if (prev.length > 80 && curr.length > 80) {
      const prevHead = prev.slice(0, 120);
      const currHead = curr.slice(0, 120);
      if (prev.includes(currHead) || curr.includes(prevHead)) return true;
    }
    return false;
  }

  _normalizeTextForLoopCheck(text = '') {
    return String(text || '')
      .replace(/\s+/g, '')
      .replace(/[，。！？：；、“”"'`~!@#$%^&*()_+\-=[\]{}|\\<>/?]+/g, '')
      .slice(0, 600);
  }

  _extractErrorMessage(err) {
    if (!err) return '未知错误';
    const msg = err?.data?.error?.message || err?.message || String(err);
    return String(msg || '未知错误');
  }

  _isContextTooLongError(err) {
    if (!err) return false;
    const msg = this._extractErrorMessage(err).toLowerCase();
    return msg.includes('maximum context length')
      || msg.includes('context_length_exceeded')
      || msg.includes('too many tokens')
      || (msg.includes('requested') && msg.includes('tokens'));
  }

  _isInsufficientBalanceError(err) {
    if (!err) return false;
    const statusCode = Number(err?.statusCode || err?.status || 0);
    if (statusCode === 402) return true;
    const message = this._extractErrorMessage(err).toLowerCase();
    return message.includes('insufficient balance')
      || message.includes('余额不足')
      || message.includes('quota exceeded')
      || message.includes('billing');
  }

  _isLikelyTruncated(text = '', finishReason = '') {
    const reason = String(finishReason || '').toLowerCase();
    if (reason.includes('length') || reason.includes('max_tokens')) return true;

    const content = String(text || '').trim();
    if (!content) return true;
    if (/第\s*\d+\s*[-~—到至]?\s*$/.test(content)) return true;
    if (/[（(][^）)]*$/.test(content)) return true;
    if (/[：:，,、]\s*$/.test(content)) return true;
    if (content.length > 800 && !/[。！？.!?]$/.test(content)) return true;
    return false;
  }

  _extractExplicitTaskMaxChapter(text = '') {
    let maxChapter = 0;
    const source = String(text || '');

    const rangeRegex = /第\s*(\d+)\s*[-~—到至]\s*(\d+)\s*章/g;
    let match;
    while ((match = rangeRegex.exec(source)) !== null) {
      const end = Number(match[2]) || 0;
      if (end > maxChapter) maxChapter = end;
    }

    return maxChapter;
  }

  // ==================== 主入口（对标 Toonflow call :694-735）====================

  /**
   * 主入口：处理用户消息，驱动 Agent 对话
   * 与 Toonflow 完全一致：单次 aiStream 调用，SDK 自动执行工具
   */
  async chat(projectId, userId, userMessage, res, abortSignal, pointCallbacks = {}) {
    const { ctx, app } = this;

    /* 保存积分回调引用，供 invokeSubAgent 等方法使用 */
    this._pointCallbacks = pointCallbacks;

    /* 1. 保存用户消息 */
    await this.saveMessage(projectId, userId, 'user', userMessage);

    /* 1.1 大纲阶段前置门禁：故事线未完成时，先引导补全故事线 */
    if (this._needsOutlinePrerequisite(userMessage)) {
      const outlineGuard = await this._checkOutlinePrerequisite(projectId);
      if (!outlineGuard.allowed) {
        this._sseWrite(res, { type: 'agentText', content: outlineGuard.message });
        await this.saveMessage(projectId, userId, 'assistant', outlineGuard.message, 'main');
        return outlineGuard.message;
      }
    }

    /* 2. 构建主 Agent 上下文 */
    this._sseWrite(res, { type: 'thinking', message: '正在准备上下文...' });

    const systemPrompt = loadPrompt('main_agent');
    const envContext = await this.buildEnvironmentContext(projectId);

    /* 3. 重建对话历史（只取 user/assistant 文本消息） */
    const history = await this.getChatHistory(projectId);
    const recentHistory = history.slice(-20);

    const messages = [...recentHistory];

    /* 确保最后一条是当前用户消息 */
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    /* 4. 单次 aiStream 调用 — 获取用户自定义模型配置，未配置则抛异常 */
    const aiConfig = await this.ctx.service.api.modelConfig.getEffectiveAiConfig(userId, 'script_gen');
    if (!aiConfig) {
      throw new Error('MODEL_NOT_CONFIGURED');
    }
    let result;
    try {
      result = await aiStream(aiConfig, {
        system: `${systemPrompt}\n\n## 当前项目信息\n${envContext}`,
        tools: this._getAllTools(projectId, userId, res, abortSignal),
        messages,
        maxStep: 100,
        maxTokens: 4096,
        abortSignal,
      });
    } catch (err) {
      if (this._isInsufficientBalanceError(err)) {
        const msg = '当前AI供应商余额不足（402: Insufficient Balance），本次请求未执行。请先充值或切换模型后重试。';
        this._sseWrite(res, { type: 'agentText', content: msg });
        await this.saveMessage(projectId, userId, 'assistant', msg, 'main');
        return msg;
      }
      throw err;
    }

    /* 5. 遍历 fullStream — 对标 Toonflow for await (const item of fullStream) */
    let fullMainResponse = '';
    let hasSubAgentToolCall = false;
    let mainStreamFailed = false;
    try {
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          const delta = chunk.textDelta ?? chunk.text ?? '';
          if (!delta) continue;
          fullMainResponse += delta;
          this._sseWrite(res, { type: 'agentText', content: delta });
          /* 通知 controller 主Agent文本输出字数 */
          if (this._pointCallbacks?.onMainAgentText) {
            this._pointCallbacks.onMainAgentText(delta.length);
          }
        } else if (chunk.type === 'tool-call') {
          const toolName = chunk.toolName;
          if (SUB_AGENT_MAP[toolName]) {
            hasSubAgentToolCall = true;
            continue;
          }
          /* 子 Agent 调用不在这里发 transfer — invokeSubAgent 内部会发 */
          this._sseWrite(res, {
            type: 'toolCall', tool: toolName,
            toolTitle: TOOL_TITLE_MAP[toolName] || `正在执行: ${toolName}`,
            status: 'calling',
          });
        }
        // tool-result, finish-step 等由 SDK 自动处理
      }
    } catch (err) {
      mainStreamFailed = true;
      if (this._isInsufficientBalanceError(err)) {
        const msg = '当前AI供应商余额不足（402: Insufficient Balance），已停止本次自动调度。请先充值或切换模型后重试。';
        this._sseWrite(res, { type: 'agentText', content: msg });
        await this.saveMessage(projectId, userId, 'assistant', msg, 'main');
        return msg;
      }
      ctx.logger.error('[NovelAgent] 主Agent流式输出错误: %s', err.message);
      this._sseWrite(res, { type: 'agentText', content: `\n\n[错误] ${err.message}` });
    }

    /* 兜底：若主Agent未触发任何子Agent工具，但用户意图明确需要创作/审核，则强制调度子Agent */
    const isPointInsufficient = this._pointCallbacks?.isPointInsufficient?.() || false;
    if (!mainStreamFailed && !hasSubAgentToolCall && !isPointInsufficient && this._needsForcedDelegation(userMessage)) {
      const fallback = await this._buildFallbackDelegation(userMessage, projectId);
      ctx.logger.warn('[NovelAgent] 主Agent未触发子Agent，执行兜底调度: %s', fallback.agentType);

      let reviewedByDirector = true;
      if (fallback.agentType === 'AI1') {
        const tools = ctx.service.api.novelAgentTools;
        const beforeCoverage = await tools.getStorylineCoverage(projectId);
        await this.invokeSubAgent(fallback.agentType, fallback.task, projectId, userId, res, abortSignal);
        const afterCoverage = await tools.getStorylineCoverage(projectId);
        const hasProgress = afterCoverage.coveredMaxChapter > beforeCoverage.coveredMaxChapter;

        if (hasProgress) {
          await this.invokeSubAgent('director', fallback.reviewTask, projectId, userId, res, abortSignal);
        } else {
          reviewedByDirector = false;
          this._sseWrite(res, {
            type: 'agentText',
            content: '本轮故事线未检测到有效保存进度，已跳过导演审核，避免审核旧内容。请继续生成故事线。',
          });
        }
      } else {
        await this.invokeSubAgent(fallback.agentType, fallback.task, projectId, userId, res, abortSignal);
        await this.invokeSubAgent('director', fallback.reviewTask, projectId, userId, res, abortSignal);
      }

      const fallbackMessage = reviewedByDirector
        ? `已按流程完成调度：${SUB_AGENT_MAP[fallback.agentType]?.name || fallback.agentType}执行完成，导演已审核。请查看上方结果，有需要我继续调整。`
        : `已按流程完成调度：${SUB_AGENT_MAP[fallback.agentType]?.name || fallback.agentType}执行完成。由于未检测到新保存进度，导演审核已跳过。`;
      this._sseWrite(res, { type: 'agentText', content: fallbackMessage });
      fullMainResponse = fallbackMessage;
    }

    /* 6. 保存主 Agent 回复 */
    if (fullMainResponse) {
      await this.saveMessage(projectId, userId, 'assistant', fullMainResponse, 'main');
    }

    return fullMainResponse;
  }

  // ==================== 辅助方法 ====================

  /**
   * SSE 写入辅助
   */
  _sseWrite(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) { /* 连接已断开 */ }
  }

  /**
   * 判断是否需要强制走子Agent调度兜底
   */
  _needsForcedDelegation(userMessage = '') {
    const text = userMessage || '';
    if (this._isStatusCheckQuery(text)) return false;
    const hasOutlineIntent = this._hasOutlineIntent(text);
    const hasStoryIntent = /(故事线|继续分析|分析章节)/.test(text);
    const hasActionIntent = /(生成|继续|追加|扩展|修改|重写|分析|审核|开始)/.test(text);
    return hasActionIntent && (hasOutlineIntent || hasStoryIntent);
  }

  _isStatusCheckQuery(text = '') {
    return /(完毕了吗|完成了吗|好了吗|做完了吗|生成完了|分析完了|搞定了吗|进度|状态|完整吗|覆盖了吗|怎么样了)/.test(text);
  }

  async _isStorylineComplete(projectId) {
    const tools = this.ctx.service.api.novelAgentTools;
    const coverage = await tools.getStorylineCoverage(projectId);
    return coverage && coverage.isComplete;
  }

  /**
   * 判断用户是否在表达大纲意图
   */
  _hasOutlineIntent(userMessage = '') {
    const text = userMessage || '';
    return /(大纲|分集|第\s*\d+\s*集|继续生成|追加|扩展|重写|改写)/.test(text);
  }

  /**
   * 是否命中“大纲创作”意图（用于前置门禁）
   */
  _needsOutlinePrerequisite(userMessage = '') {
    const text = userMessage || '';
    const hasOutlineScope = /(大纲|分集|第\s*\d+\s*集)/.test(text);
    const hasCreateAction = /(生成|继续|追加|扩展|重写|改写|编写|创建|开始)/.test(text);
    return hasOutlineScope && hasCreateAction;
  }

  /**
   * 大纲前置检查：必须先完成故事线覆盖
   */
  async _checkOutlinePrerequisite(projectId) {
    const tools = this.ctx.service.api.novelAgentTools;
    const coverage = await tools.getStorylineCoverage(projectId);

    if (coverage.isComplete) {
      return { allowed: true, message: '' };
    }

    const message = coverage.hasStoryline
      ? `进入大纲阶段前，请先补全故事线。当前故事线覆盖到第${coverage.coveredMaxChapter}章，已选章节上限是第${coverage.selectedMaxChapter}章。请先说“继续分析故事线”完成到第${coverage.selectedMaxChapter}章。`
      : '进入大纲阶段前，请先生成完整故事线。请先说“开始分析故事线”。';

    return { allowed: false, message };
  }

  /**
   * 给子Agent任务注入“数据库真值”约束，避免被聊天历史误导
   */
  async _decorateTaskWithCoverage(agentType, task, projectId) {
    const tools = this.ctx.service.api.novelAgentTools;
    const baseTask = task || '';

    if (agentType === 'AI2') {
      const { ctx } = this;
      const coverage = await tools.getOutlineCoverage(projectId);
      const episodeHint = await this._buildEpisodeHint(baseTask, projectId);
      const isRegenerateSpecific = /(重新生成|重写|重做|重新修改)/.test(baseTask) && /第\s*[\d二三四五六七八九十]+\s*(集|章)/.test(baseTask);

      const totalChapters = await ctx.model.NovelChapter.count({ where: { novel_project_id: projectId, is_selected: 1 } });
      const projectInfo = await ctx.model.NovelProject.findOne({ where: { id: projectId }, attributes: ['total_episodes'], raw: true });
      const totalEpisodes = Number(projectInfo?.total_episodes) || 0;

      /* ========== 优先从规划表获取章节分配（规划师生成的全局最优分配） ========== */
      const nextEpisodeNumber = coverage.totalEpisodes + 1;
      const planItem = await tools.getEpisodePlanForEpisode(projectId, nextEpisodeNumber);

      let chapterRatioHint = '';
      if (planItem && Array.isArray(planItem.chapters) && planItem.chapters.length > 0) {
        /* 规划表模式：直接使用规划师确定的章节分配 */
        const chapterNumbers = planItem.chapters;
        const chStart = chapterNumbers[0];
        const chEnd = chapterNumbers[chapterNumbers.length - 1];
        chapterRatioHint = `\n- 📐 【规划表约束 - 铁律】本集（第${nextEpisodeNumber}集）的章节分配由规划师预先确定，不可更改`
          + `\n- 📐 本集必须且只能覆盖第${chStart}-${chEnd}章（共${chapterNumbers.length}章），请调用 getChapter({ chapterNumbers: [${chapterNumbers.join(',')}] }) 获取这些章节后合并生成1集大纲`
          + `\n- 📐 chapterRange 必须设为 [${chapterNumbers.join(', ')}]，禁止多取或少取`
          + `\n- 📐 规划说明：${planItem.summary || '无'}`;
        ctx.logger.info('[NovelAgent] AI2使用规划表分配：第%d集 → 第%d-%d章（共%d章）', nextEpisodeNumber, chStart, chEnd, chapterNumbers.length);
      } else {
        /* 回退：无规划表时使用动态计算（兼容旧项目） */
        const remainingChapters = Math.max(0, totalChapters - coverage.maxChapter);
        const remainingEpisodes = Math.max(1, totalEpisodes - coverage.totalEpisodes);
        const dynamicRatio = remainingChapters > 0 && remainingEpisodes > 0
          ? remainingChapters / remainingEpisodes
          : (totalChapters > 0 && totalEpisodes > 0 ? totalChapters / totalEpisodes : 0);
        const suggestedCount = dynamicRatio > 0 ? Math.round(dynamicRatio) : 0;
        const suggestedEnd = suggestedCount > 0 ? Math.min(coverage.nextChapter + suggestedCount - 1, totalChapters) : 0;
        const chapterNumbers = [];
        if (suggestedCount > 0) {
          for (let i = coverage.nextChapter; i <= suggestedEnd; i++) chapterNumbers.push(i);
        }
        if (suggestedCount > 0) {
          const strictWarning = suggestedCount <= 2
            ? `\n- 🚨 警告：当前章节资源紧张（${remainingChapters}章分${remainingEpisodes}集），每集只允许覆盖${suggestedCount}章！多拿1章都会导致后面集数没有章节可用！`
            : '';
          chapterRatioHint = `\n- 📐 章节分配（强制执行，违反则输出无效）：剩余${remainingChapters}章 / 剩余${remainingEpisodes}集 = 每集必须覆盖${suggestedCount}章\n- 📐 本集必须且只能覆盖第${coverage.nextChapter}-${suggestedEnd}章（共${suggestedCount}章），请调用 getChapter({ chapterNumbers: [${chapterNumbers.join(',')}] }) 获取这些章节后合并生成1集大纲\n- 📐 chapterRange 必须设为 [${chapterNumbers.join(', ')}]，禁止多取或少取${strictWarning}`;
        }
      }

      if (isRegenerateSpecific && episodeHint) {
        /* 重新生成特定集时，也尝试从规划表获取该集的章节分配 */
        const match = String(baseTask).match(/第\s*(\d+)\s*集/);
        const targetEp = match ? Number(match[1]) : 0;
        let regenPlanHint = '';
        if (targetEp > 0) {
          const regenPlanItem = await tools.getEpisodePlanForEpisode(projectId, targetEp);
          if (regenPlanItem && Array.isArray(regenPlanItem.chapters) && regenPlanItem.chapters.length > 0) {
            regenPlanHint = `\n- 📐 【规划表约束】第${targetEp}集应覆盖第${regenPlanItem.chapters.join(',')}章（规划师指定）`;
          }
        }
        return `【重新生成特定集大纲】\n- 当前已保存大纲共${coverage.totalEpisodes}集${episodeHint}${regenPlanHint || chapterRatioHint}\n- ⚠️ 本次任务是重新生成特定集，不是续写新集，连续性检查不适用\n- 保存时必须使用 insertEpisodeOutline 工具（不是 saveOutline），它可以在指定集数位置插入或替换大纲\n- 生成完成后调用 insertEpisodeOutline({ episodeNumber: 目标集数, data: 完整大纲数据 })\n\n${baseTask}`;
      }

      return `【连续性硬约束（仅适用于续写新集）】\n- 当前已保存大纲共${coverage.totalEpisodes}集\n- 已覆盖到原文第${coverage.maxChapter}章\n- 本次新增大纲必须从第${coverage.nextChapter}章开始\n- 续写时禁止依据聊天历史猜测章节进度，必须以数据库覆盖进度为准\n- 为避免超长输出，必须逐集生成：每次只生成1集并立即调用 saveOutline 保存\n- 若用户要求多集，按“单集生成→单集保存”循环执行，直到达到目标集数${chapterRatioHint}${episodeHint}\n\n${baseTask}`;
    }

    if (agentType === 'AI1') {
      const coverage = await tools.getStorylineCoverage(projectId);
      const covMax = coverage.coveredMaxChapter;
      const selMax = coverage.selectedMaxChapter;
      return [
        '【故事线进度约束（以数据库为唯一真值）】',
        '- 已选章节共' + coverage.selectedCount + '章，最大章节为第' + selMax + '章',
        '- 数据库中故事线已保存到第' + covMax + '章（这是唯一可信进度）',
        '- 本次分析必须从第' + (covMax + 1) + '章开始，严禁重复分析已保存的章节',
        '- 重要：对话历史中可能存在之前因AI断连而未保存的分析内容，那些内容无效，不要参考',
        '- 严禁依据聊天历史推断章节进度，只认数据库中已保存的故事线覆盖范围',
        '- 每次分析完一段章节后，必须立即调用 saveStoryline 保存，不要攒到最后',
        '',
        baseTask,
      ].join('\n');
    }

    return baseTask;
  }

  /**
   * 构建主Agent漏调度时的兜底任务
   * 当涉及特定集数时，从数据库中查出该集的准确信息硬注入，避免AI从长列表中自行配对出错
   */
  async _buildFallbackDelegation(userMessage = '', projectId = null) {
    const text = userMessage || '';
    const storyOnlyIntent = /(故事线|继续分析|分析章节)/.test(text) && !/(大纲|分集|第\s*\d+\s*集)/.test(text);

    if (storyOnlyIntent) {
      return {
        agentType: 'AI1',
        task: `用户请求：${text}\n请按故事线流程完成任务，必要时调用 getChapter/getStoryline/saveStoryline。`,
        reviewTask: `用户原始请求是：「${text}」\n请审核该请求对应的最新故事线结果（注意：只审核与用户请求相关的内容，不要被对话历史中其他集数的讨论干扰），严格按导演审核规范输出。`,
      };
    }

    /* 提取用户请求中的目标集数，查数据库获取准确信息 */
    const episodeHint = await this._buildEpisodeHint(text, projectId);

    return {
      agentType: 'AI2',
      task: `用户请求：${text}${episodeHint}\n请按大纲流程完成任务，必要时调用 getOutline/getStoryline/getChapter，并调用 saveOutline 保存。若是继续新增集数，请使用追加模式 overwrite=false。必须逐集生成并逐集保存（每次saveOutline仅1集）。`,
      reviewTask: `用户原始请求是：「${text}」${episodeHint}\n请审核该请求对应的最新大纲结果（注意：只审核与用户请求相关的集数，不要被对话历史中其他集数的讨论干扰），严格按导演审核规范输出。`,
    };
  }

  /**
   * 从用户消息中提取目标集数，查数据库构建准确信息提示
   * 硬注入给AI，避免AI从长列表中自行配对出错
   */
  async _buildEpisodeHint(text = '', projectId = null) {
    if (!projectId) return '';
    const match = String(text).match(/第\s*(\d+)\s*集/);
    if (!match) return '';

    const targetEp = Number(match[1]);
    if (!targetEp || targetEp <= 0) return '';

    try {
      const { ctx } = this;
      const record = await ctx.model.NovelEpisode.findOne({
        where: { novel_project_id: projectId, episode_number: targetEp },
        attributes: ['id', 'episode_number', 'title', 'chapter_range'],
        raw: true,
      });
      if (!record) return '';

      const chapterRangeList = ctx.helper.parseJsonArray(record.chapter_range, []);
      const chapterRange = chapterRangeList.length ? chapterRangeList.join(', ') : '未知';

      return `\n\n【⚠️ 数据库真实信息（唯一可信源，禁止自行从大纲列表配对）】\n- 目标集数：第${targetEp}集\n- 大纲ID：${record.id}\n- 当前标题：${record.title}\n- 对应章节：第${chapterRange}章\n- 操作要求：获取大纲时必须使用 getOutline({ episodeNumber: ${targetEp} }) 只获取该集；获取章节原文时必须使用 getChapter({ chapterNumbers: [${chapterRange}] })`;
    } catch (e) {
      return '';
    }
  }

  /**
   * 获取最近用户消息摘要（供子 Agent 了解对话背景）
   */
  async _getRecentUserMessages(projectId) {
    const { ctx } = this;
    const records = await ctx.model.NovelChatHistory.findAll({
      where: { novel_project_id: projectId, role: 'user' },
      order: [['created_at', 'DESC']],
      attributes: ['content'],
      limit: 5,
      raw: true,
    });
    if (!records.length) return '无对话历史';
    return records.reverse().map(r => r.content).join('\n');
  }

  /**
   * 获取对话历史（简化版，只取 user/assistant 文本消息）
   * 对标 Toonflow 的 this.history（内存数组），但从 DB 重建
   */
  async getChatHistory(projectId, limit = 30) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;
    const records = await ctx.model.NovelChatHistory.findAll({
      where: {
        novel_project_id: projectId,
        role: { [Op.in]: ['user', 'assistant'] },
      },
      order: [['created_at', 'ASC']],
      attributes: ['role', 'content', 'agent_type'],
      limit,
      raw: true,
    });
    return records
      .filter(r => r.content && r.content.trim())
      .filter(r => r.role === 'user' || !r.agent_type || r.agent_type === 'main')
      .map(r => ({ role: r.role, content: r.content }));
  }

  /**
   * 保存对话消息
   */
  async saveMessage(projectId, userId, role, content, agentType = null) {
    await this.ctx.model.NovelChatHistory.create({
      novel_project_id: projectId,
      user_id: userId,
      role,
      content: content || '',
      agent_type: agentType,
    });
  }

  /**
   * 清空对话历史
   */
  async clearHistory(projectId, userId) {
    await this.ctx.model.NovelChatHistory.destroy({
      where: { novel_project_id: projectId, user_id: userId },
    });
  }

  /**
   * 获取对话历史（前端展示用）
   */
  async getHistoryForDisplay(projectId, userId) {
    const { ctx } = this;
    const records = await ctx.model.NovelChatHistory.findAll({
      where: { novel_project_id: projectId, user_id: userId },
      order: [['created_at', 'ASC']],
      raw: true,
    });

    return records.map(r => ({
      id: String(r.id),
      role: r.role,
      agentType: r.agent_type,
      content: r.content || '',
      createdAt: r.created_at,
    }));
  }
}

module.exports = NovelAgentService;
