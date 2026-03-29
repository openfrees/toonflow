'use strict';

/**
 * 数据适配器：EpisodeData ↔ 数据库字段
 * 用于在 Toonflow 完整结构和数据库拆分结构之间转换
 */
class NovelAgentAdapter {

  /**
   * EpisodeData → 数据库字段（写入时）
   * 对标 Toonflow 的完整 EpisodeData 结构
   */
  static toDatabase(episodeData) {
    const duration = Number(episodeData.episodeDuration || episodeData.duration || 0) || null;
    const detail = {
      episodeIndex: episodeData.episodeIndex,
      episodeDuration: duration,
      coreConflict: episodeData.coreConflict || '',
      openingHook: episodeData.openingHook || '',
      endingHook: episodeData.endingHook || '',
      keyEvents: episodeData.keyEvents || [],
      emotionalCurve: episodeData.emotionalCurve || '',
      visualHighlights: episodeData.visualHighlights || [],
      classicQuotes: episodeData.classicQuotes || [],
      characters: episodeData.characters || [],
      scenes: episodeData.scenes || [],
      props: episodeData.props || [],
    };

    return {
      title: episodeData.title || '',
      chapter_range: episodeData.chapterRange || [],
      outline: episodeData.outline || '',
      outline_detail: detail,
      data: JSON.stringify(episodeData), // 同时存 data 字段（完整备份）
    };
  }

  /**
   * 数据库字段 → EpisodeData（读取时）
   * 优先从 data 字段读取，如果没有则从拆分字段合并
   */
  static fromDatabase(dbRecord) {
    // 优先尝试从 data 字段读取（新数据）
    if (dbRecord.data) {
      try {
        const parsed = typeof dbRecord.data === 'string'
          ? JSON.parse(dbRecord.data)
          : dbRecord.data;
        return parsed;
      } catch (e) {
        console.error('[Adapter] 解析 data 字段失败，回退到拆分字段:', e.message);
      }
    }

    // 回退：从拆分字段合并（旧数据兼容）
    // outline_detail / chapter_range 在 TEXT 存储 + raw:true 下可能是 JSON 字符串
    const rawDetail = dbRecord.outline_detail;
    const detail = (rawDetail && typeof rawDetail === 'object')
      ? rawDetail
      : this._safeParse(rawDetail, {});
    const rawRange = dbRecord.chapter_range;
    const chapterRange = Array.isArray(rawRange)
      ? rawRange
      : this._safeParse(rawRange, []);
    return {
      episodeDuration: detail.episodeDuration || dbRecord.episodeDuration || null,
      episodeIndex: detail.episodeIndex || dbRecord.episode_number,
      title: dbRecord.title || '',
      chapterRange,
      outline: dbRecord.outline || '',
      coreConflict: detail.coreConflict || '',
      openingHook: detail.openingHook || '',
      endingHook: detail.endingHook || '',
      keyEvents: detail.keyEvents || [],
      emotionalCurve: detail.emotionalCurve || '',
      visualHighlights: detail.visualHighlights || [],
      classicQuotes: detail.classicQuotes || [],
      characters: detail.characters || [],
      scenes: detail.scenes || [],
      props: detail.props || [],
    };
  }
  /** TEXT 字段安全反序列化：对象/数组直接返回，字符串尝试 JSON.parse，其余走兜底 */
  static _safeParse(value, defaultValue = null) {
    if (value === null || value === undefined || value === '') return defaultValue;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return defaultValue;
    try {
      return JSON.parse(value);
    } catch (_) {
      return defaultValue;
    }
  }
}

module.exports = NovelAgentAdapter;
