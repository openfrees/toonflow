'use strict';

const { Service } = require('egg');

/**
 * 封面图服务
 * 处理封面描述词生成、封面图生成等业务逻辑
 * 支持两种项目类型：script（自己写剧本）/ novel（小说转剧本）
 */
class CoverService extends Service {

  /**
   * 【自己写剧本】获取剧本信息并拼接封面描述词生成的prompt
   * 从剧本表获取标题、基本信息、剧情梗概，从关联表获取题材
   * @param {number} scriptId - 剧本真实ID
   * @returns {Promise<string>} 拼接好的prompt字符串
   */
  async buildCoverPromptInput(scriptId) {
    const { ctx } = this;

    const script = await ctx.model.Script.findOne({
      where: { id: scriptId },
      attributes: ['id', 'title', 'basic_info', 'synopsis', 'custom_genres', 'gender', 'style'],
      raw: true,
    });

    if (!script) {
      ctx.throw(404, '剧本不存在');
    }

    /* 获取系统题材名称 */
    const genreRelations = await ctx.model.ScriptGenre.findAll({
      where: { script_id: scriptId },
      raw: true,
    });
    let genreNames = [];
    if (genreRelations.length > 0) {
      const genreIds = genreRelations.map(r => r.genre_id);
      const genres = await ctx.model.Genre.findAll({
        where: { id: genreIds },
        raw: true,
      });
      genreNames = genres.map(g => g.name);
    }

    /* 拼接自定义题材 */
    const customGenres = script.custom_genres
      ? script.custom_genres.split('/').filter(Boolean)
      : [];
    const allGenres = [...genreNames, ...customGenres];

    /* 截取剧情梗概前200字作为核心梗概 */
    const synopsisShort = (script.synopsis || '').slice(0, 200);

    /* 拼接剧本信息字符串 */
    const parts = [];
    if (script.title) {
      parts.push(`【标题】《${script.title}》`);
    }
    if (script.basic_info) {
      parts.push(`【基本信息】${script.basic_info}`);
    }
    if (synopsisShort) {
      parts.push(`【剧情梗概】${synopsisShort}`);
    }
    if (allGenres.length > 0) {
      parts.push(`【题材】${allGenres.join('、')}`);
    }
    /* 明确传入项目画风，避免默认日系动漫时被题材/案例误导成其他风格 */
    if (script.style) {
      parts.push(`【用户指定画风】${script.style}`);
    } else if (allGenres.length > 0) {
      const style = this._getStyleByGenres(allGenres);
      parts.push(`【推荐画风】${style}`);
    }
    if (script.gender === '女频') {
      parts.push(`【主角性别】女性`);
    } else if (script.gender === '男频') {
      parts.push(`【主角性别】男性`);
    }
    if (script.title) {
      parts.push(`描述词最后加上，"画面上方留剧名《${script.title}》"`);
    }
    return parts.join('\n');
  }

  /**
   * 【小说转剧本】获取小说项目信息并拼接封面描述词生成的prompt
   * 数据来源：NovelProject（标题/题材/性别/角色） + NovelStoryline（故事线）
   * 故事线可能非常长（几万字），需要智能截取核心信息
   * @param {number} novelProjectId - 小说项目真实ID
   * @returns {Promise<string>} 拼接好的prompt字符串
   */
  async buildNovelCoverPromptInput(novelProjectId) {
    const { ctx } = this;

    const project = await ctx.model.NovelProject.findOne({
      where: { id: novelProjectId },
      attributes: ['id', 'title', 'gender', 'genres', 'characters', 'art_style'],
      raw: true,
    });

    if (!project) {
      ctx.throw(404, '小说项目不存在');
    }

    /* 获取故事线 */
    const storyline = await ctx.model.NovelStoryline.findOne({
      where: { novel_project_id: novelProjectId },
      attributes: ['content'],
      raw: true,
    });

    const parts = [];

    /* 标题 */
    if (project.title) {
      parts.push(`【标题】《${project.title}》`);
    }

    /* 题材（JSON数组，直接取） */
    const allGenres = this._parseGenres(project.genres);
    if (allGenres.length > 0) {
      parts.push(`【题材】${allGenres.join('、')}`);
    }

    /* 明确传入项目画风，默认值也要带上，避免被题材推荐覆盖 */
    if (project.art_style) {
      parts.push(`【用户指定画风】${project.art_style}`);
    } else if (allGenres.length > 0) {
      const style = this._getStyleByGenres(allGenres);
      parts.push(`【推荐画风】${style}`);
    }

    /* 受众性别 → 主角性别 */
    if (project.gender === '女频') {
      parts.push(`【主角性别】女性`);
    } else if (project.gender === '男频') {
      parts.push(`【主角性别】男性`);
    }

    /* 角色信息（截取核心，最多300字） */
    if (project.characters) {
      const charShort = this._truncateText(project.characters, 300);
      parts.push(`【主要角色】${charShort}`);
    }

    /**
     * 故事线（核心优化点）
     * 故事线通常是 Markdown 格式，包含：总览、分阶段叙述、人物关系变化、伏笔、高潮等
     * 封面图只需要核心剧情梗概，不需要详细的分阶段叙述
     * 策略：提取"总览"段 + 截取前800字
     */
    if (storyline?.content) {
      const storyDigest = this._extractStorylineDigest(storyline.content);
      parts.push(`【核心剧情】${storyDigest}`);
    }

    /* 剧名预留 */
    if (project.title) {
      parts.push(`描述词最后加上，"画面上方留剧名《${project.title}》"`);
    }

    return parts.join('\n');
  }

  /**
   * 从故事线长文中提取核心摘要
   * Markdown故事线通常结构：## 总览 / ## 第一阶段 / ## 人物关系 / ## 高潮 等
   * 优先提取"总览"或开头部分，控制总长度不超过800字
   * @param {string} content - 故事线完整Markdown内容
   * @returns {string} 截取后的核心摘要
   * @private
   */
  _extractStorylineDigest(content) {
    if (!content) return '';

    /* 尝试提取"总览"/"概述"/"简介"段落（## 标题到下一个 ## 之间的内容） */
    const overviewMatch = content.match(/##\s*(?:总览|概述|简介|故事概要|剧情总览|整体概要)[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|\$)/);
    if (overviewMatch && overviewMatch[1].trim().length > 50) {
      const overview = overviewMatch[1].trim();
      /* 总览足够丰富，直接用（截800字） */
      return this._truncateText(overview, 800);
    }

    /* 没有明确的"总览"段，采用智能截取策略 */
    /* 去掉 Markdown 格式符号，提取纯文本 */
    const plainText = content
      .replace(/^#{1,6}\s+.*$/gm, '') // 去掉标题行
      .replace(/^\s*[-*]\s+/gm, '') // 去掉列表符号
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 去掉加粗
      .replace(/\*([^*]+)\*/g, '$1') // 去掉斜体
      .replace(/\n{3,}/g, '\n\n') // 合并多余空行
      .trim();

    return this._truncateText(plainText, 800);
  }

  /**
   * 安全截取文本，在自然断句处截断
   * @param {string} text - 原始文本
   * @param {number} maxLen - 最大长度
   * @returns {string}
   * @private
   */
  _truncateText(text, maxLen) {
    if (!text || text.length <= maxLen) return text || '';

    let truncated = text.slice(0, maxLen);
    /* 尝试在句号/感叹号/问号处截断，避免断在半句中间 */
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('；'),
      truncated.lastIndexOf('\n')
    );
    if (lastSentenceEnd > maxLen * 0.6) {
      truncated = truncated.slice(0, lastSentenceEnd + 1);
    }
    return truncated + '...（已截取核心剧情）';
  }

  /**
   * 解析题材字段（兼容JSON数组和逗号分隔字符串）
   * @param {*} genres - 题材数据
   * @returns {string[]}
   * @private
   */
  _parseGenres(genres) {
    if (!genres) return [];
    if (Array.isArray(genres)) return genres.filter(Boolean);
    if (typeof genres === 'string') {
      try {
        const parsed = JSON.parse(genres);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (_) {
        return genres.split(/[,，、/]/).map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  /**
   * 构建发送给DeepSeek的消息列表（生成封面描述词）
   * 通用方法，script 和 novel 共用同一套 system prompt
   * @param {string} scriptInfo - 拼接好的剧本/小说信息
   * @returns {Array<{role: string, content: string}>}
   */
  buildCoverPromptMessages(scriptInfo) {
    const systemPrompt = `你是一位专业的AI绘画提示词工程师，擅长将短剧剧本信息转化为高质量的文生图描述词。

## 核心原则（必须遵守！）

### 1. 风格精准化
- 必须明确指定画风：日式动漫风格/国风工笔画/韩漫风格/赛博朋克风格等
- 如果用户提供了【推荐画风】或【用户指定画风】，必须使用该画风
- 如果没有推荐画风，根据题材自动判断（末世/玄幻→日漫，古风→国风，都市→韩漫）
- **如果用户提供了【主角性别】，主角必须是对应性别（女性→女主角，男性→男主角）**

### 2. 动作具象化
- 用"动词+名词"描述人物，不用形容词
- ✅ 好："手托着微型猛兽"
- ❌ 差："眼神坚定且充满智慧"

### 3. 能力可视化（重点！）
如果剧本中有特殊能力，必须转化为可见的视觉元素：
- 缩小能力 → 手托/指尖托着被缩小的物体（猛兽、建筑、人物）
- 放大能力 → 手持/攥着被放大的物体（武器、宝物、道具）
- 时间倒流 → 身后浮现倒转的时钟/沙漏
- 读心术 → 周围浮现透明思维气泡
- 瞬移 → 身影残像/空间裂痕
- 火焰能力 → 手掌燃烧火焰/身后火焰翅膀
- 冰冻能力 → 手掌凝结冰晶/地面冰霜蔓延
- 治愈能力 → 手掌发光/绿色光芒笼罩
- 透视 → 眼睛发光/X光视觉效果
- 隐身 → 身体半透明/轮廓虚化
- 预知未来 → 眼中浮现未来画面碎片
- 控制元素 → 手掌周围环绕对应元素（水/火/土/风）

### 4. 人物关系空间化
如果有多个人物，必须描述：
- 空间位置："站在前景"、"侧后方"、"背景中"
- 视线交互："眼神看向"、"冷眼扫向"、"背对"
- 情绪对比："冷静vs得意"、"愤怒vs嘲讽"、"坚毅vs狂妄"

### 5. 色调简洁化
- 主色调≤2种，避免混乱
- 根据题材选择：
  - 末世 → 暗灰+橙红
  - 古风 → 青绿+金色
  - 都市 → 冷蓝+霓虹紫
  - 修仙 → 青蓝+白金
  - 悬疑 → 深蓝+暗红

### 6. 功能性预留
- 必须在描述词最后加上："画面上方预留位置放剧名《xxx》"

## 优秀案例参考

【案例1 - 末世重生】
剧本：末世来临，姐弟觉醒放大/缩小能力，前世姐姐被弟弟害死，重生后弟弟抢了放大，姐姐用缩小逆袭。
描述词：日式动漫风格竖版构图（3:4），冷飒坚毅的末世女主站在焦土废墟前，指尖托着被缩小千倍的猛兽，眼神锐利看向侧后方一脸得意、攥着放大千倍异能宝物的弟弟，整体为暗灰加橙红的末世废土色调，画面上方预留位置放剧名《我弟抢了我的金手指》

【案例2 - 古风修仙】
剧本：废柴少年意外获得上古神器，从此逆天改命，踏上修仙之路。
描述词：国风工笔画风格竖版构图（3:4），白衣少年立于山巅，手托散发金光的上古神器，身后仙鹤盘旋、云海翻涌，远处若隐若现的仙宫，整体为青蓝加金色的仙侠色调，画面上方预留位置放剧名《废柴逆袭修仙路》

【案例3 - 都市霸总】
剧本：灰姑娘意外救了失忆霸总，霸总恢复记忆后疯狂追妻。
描述词：韩漫风格竖版构图（3:4），清纯女主站在都市街头，身后西装革履的霸总深情凝视，手持玫瑰花束，背景为繁华都市夜景、霓虹闪烁，整体为冷蓝加霓虹紫的都市色调，画面上方预留位置放剧名《霸总的追妻日常》

## 输出要求
1. 描述词必须是中文
2. 必须说明：竖版构图（3:4）
3. 描述词结构：【画风+构图】，【主角动作+能力展示】，【人物关系+空间构图+情绪对比】，【色调方案】，【功能预留】
4. 长度控制在100-200字
5. 不要输出任何解释说明，只输出描述词本身
6. 不要加任何前缀如"描述词："`;

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${scriptInfo}`,
      },
    ];
  }

  /**
   * 保存封面描述词
   * @param {number} id - 项目真实ID
   * @param {string} coverPrompt - 封面描述词
   * @param {string} type - 'script' | 'novel'
   */
  async saveCoverPrompt(id, coverPrompt, type = 'script') {
    const model = type === 'novel' ? this.ctx.model.NovelProject : this.ctx.model.Script;
    await model.update(
      { cover_prompt: coverPrompt },
      { where: { id } }
    );
  }

  /**
   * 保存封面图路径
   * @param {number} id - 项目真实ID
   * @param {string} coverPath - 封面图访问路径
   * @param {string} type - 'script' | 'novel'
   */
  async saveCoverImage(id, coverPath, type = 'script') {
    const model = type === 'novel' ? this.ctx.model.NovelProject : this.ctx.model.Script;
    await model.update(
      { cover: coverPath },
      { where: { id } }
    );
  }

  /**
   * 获取封面描述词
   * @param {number} id - 项目真实ID
   * @param {string} type - 'script' | 'novel'
   * @returns {Promise<string>} 封面描述词
   */
  async getCoverPrompt(id, type = 'script') {
    const model = type === 'novel' ? this.ctx.model.NovelProject : this.ctx.model.Script;
    const record = await model.findOne({
      where: { id },
      attributes: ['cover_prompt'],
      raw: true,
    });
    return record?.cover_prompt || '';
  }

  /**
   * 根据题材自动匹配画风
   * @param {Array<string>} genres - 题材数组
   * @returns {string} 画风描述
   * @private
   */
  _getStyleByGenres(genres) {
    const GENRE_TO_STYLE = {
      末世: '日式动漫风格',
      重生: '日式动漫风格',
      穿越: '日式动漫风格',
      玄幻: '日式动漫风格',
      修仙: '国风工笔画风格',
      仙侠: '国风工笔画风格',
      古风: '国风工笔画风格',
      古装: '国风工笔画风格',
      武侠: '国风写意风格',
      都市: '韩漫风格',
      霸总: '韩漫风格',
      言情: '韩漫风格',
      现代: '韩漫风格',
      科幻: '赛博朋克风格',
      未来: '赛博朋克风格',
      悬疑: '暗黑写实风格',
      惊悚: '暗黑写实风格',
    };

    for (const genre of genres) {
      for (const [ key, style ] of Object.entries(GENRE_TO_STYLE)) {
        if (genre.includes(key)) {
          return style;
        }
      }
    }

    return '日式动漫风格';
  }
}

module.exports = CoverService;
