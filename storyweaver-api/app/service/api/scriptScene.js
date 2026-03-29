'use strict';

const { Service } = require('egg');
const fs = require('fs');
const path = require('path');

const loadSceneExtractPrompt = () => {
  const promptPath = path.join(__dirname, '../../prompts/script_scene_extract.txt');
  return fs.readFileSync(promptPath, 'utf-8');
};

class ScriptSceneService extends Service {
  async getScript(id, userId) {
    const { ctx } = this;
    const script = await ctx.model.Script.findOne({
      where: { id, user_id: userId },
      raw: true,
    });
    if (!script) ctx.throw(404, '剧本不存在');
    return script;
  }

  parseParams(paramsValue) {
    if (!paramsValue) return {};
    if (typeof paramsValue === 'object') return paramsValue;
    try {
      const parsed = JSON.parse(paramsValue);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  normalizeName(name = '') {
    return String(name)
      .replace(/[（(][^)）]{0,20}[)）]/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();
  }

  normalizeScene(scene = {}) {
    const name = String(scene.name || '').trim();
    const description = String(scene.description || scene.intro || '').trim();
    const image = String(scene.image || '').trim();
    const imagePrompt = String(scene.imagePrompt || '').trim();
    const aliases = Array.isArray(scene.aliases)
      ? scene.aliases.map(a => String(a || '').trim()).filter(Boolean)
      : [];
    const episodeNumbers = Array.isArray(scene.episodeNumbers)
      ? scene.episodeNumbers.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0)
      : [];

    return {
      id: String(scene.id || '').trim() || `scene_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      image,
      imagePrompt,
      aliases: Array.from(new Set(aliases)),
      episodeNumbers: Array.from(new Set(episodeNumbers)).sort((a, b) => a - b),
      source: scene.source || 'manual',
      updatedAt: new Date().toISOString(),
    };
  }

  mergeScene(existing, incoming) {
    /* 人工场景优先：AI抽取阶段不改人工数据 */
    if (existing?.source === 'manual') {
      return existing;
    }
    if (incoming?.source === 'manual') {
      return incoming;
    }

    const mergedDesc = (incoming.description || '').length > (existing.description || '').length
      ? incoming.description
      : existing.description;
    const mergedAliases = Array.from(new Set([...(existing.aliases || []), ...(incoming.aliases || [])]))
      .filter(Boolean);
    const mergedEpisodes = Array.from(new Set([...(existing.episodeNumbers || []), ...(incoming.episodeNumbers || [])]))
      .filter(n => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);

    return {
      ...existing,
      description: mergedDesc,
      image: incoming.image || existing.image || '',
      imagePrompt: incoming.imagePrompt || existing.imagePrompt || '',
      aliases: mergedAliases,
      episodeNumbers: mergedEpisodes,
      source: existing.source || incoming.source || 'ai_extract',
      updatedAt: new Date().toISOString(),
    };
  }

  dedupeScenes(list = []) {
    const map = new Map();
    for (const raw of list) {
      const item = this.normalizeScene(raw);
      if (!item.name) continue;
      const key = this.normalizeName(item.name);
      if (!key) continue;
      if (map.has(key)) {
        map.set(key, this.mergeScene(map.get(key), item));
      } else {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }

  getRemovedSceneImages(existingScenes = [], nextScenes = []) {
    const retainedIds = new Set(
      nextScenes
        .map(item => String(item?.id || '').trim())
        .filter(Boolean)
    );
    const retainedNames = new Set(
      nextScenes
        .map(item => this.normalizeName(item?.name))
        .filter(Boolean)
    );
    const removedImages = [];

    for (const scene of existingScenes) {
      const sceneId = String(scene?.id || '').trim();
      const sceneName = this.normalizeName(scene?.name);
      const isRetained = (sceneId && retainedIds.has(sceneId))
        || (sceneName && retainedNames.has(sceneName));
      if (!isRetained && scene?.image) {
        removedImages.push(scene.image);
      }
    }
    return removedImages;
  }

  async saveScenes(scriptId, userId, scenes = []) {
    const { ctx } = this;
    const script = await this.getScript(scriptId, userId);
    const params = this.parseParams(script.params);
    const existingScenes = this.dedupeScenes(params.extractedScenes || []);
    const deduped = this.dedupeScenes(scenes);
    const removedImages = this.getRemovedSceneImages(existingScenes, deduped);
    params.extractedScenes = deduped;
    await ctx.model.Script.update(
      { params },
      { where: { id: scriptId, user_id: userId } }
    );
    for (const imagePath of removedImages) {
      ctx.helper.removeUploadedFile(imagePath);
    }
    return deduped;
  }

  async listScenes(scriptId, userId) {
    const script = await this.getScript(scriptId, userId);
    const params = this.parseParams(script.params);
    return this.dedupeScenes(params.extractedScenes || []);
  }

  async getSceneById(scriptId, userId, sceneId) {
    const scenes = await this.listScenes(scriptId, userId);
    return scenes.find(item => String(item.id) === String(sceneId)) || null;
  }

  async updateSceneFields(scriptId, userId, sceneId, fields = {}) {
    const scenes = await this.listScenes(scriptId, userId);
    const index = scenes.findIndex(item => String(item.id) === String(sceneId));
    if (index === -1) return null;
    const merged = this.normalizeScene({
      ...scenes[index],
      ...fields,
      id: scenes[index].id,
    });
    scenes[index] = merged;
    const saved = await this.saveScenes(scriptId, userId, scenes);
    return saved.find(item => String(item.id) === String(sceneId)) || merged;
  }

  async getExtractPrecheck(scriptId, userId) {
    const { ctx } = this;
    const script = await this.getScript(scriptId, userId);
    const totalEpisodes = Number(script.total_episodes || 0);
    const generatedEpisodes = await ctx.model.ScriptEpisode.count({
      where: { script_id: scriptId, user_id: userId },
    });
    return {
      totalEpisodes,
      generatedEpisodes,
      incomplete: generatedEpisodes < totalEpisodes,
    };
  }

  async getOutlineBatches(scriptId, userId, batchSize = 10) {
    const { ctx } = this;
    const episodes = await ctx.model.ScriptEpisode.findAll({
      where: { script_id: scriptId, user_id: userId },
      order: [[ 'episode_number', 'ASC' ]],
      raw: true,
    });
    const valid = episodes
      .filter(ep => ep.content && String(ep.content).trim())
      .map(ep => ({
        episodeNumber: ep.episode_number,
        title: ep.title || '',
        outline: ep.content || '',
      }));

    const batches = [];
    for (let i = 0; i < valid.length; i += batchSize) {
      batches.push(valid.slice(i, i + batchSize));
    }
    return { episodes: valid, batches };
  }

  buildExtractMessages(batch, existingScenes = []) {
    const systemPrompt = loadSceneExtractPrompt();
    const existingDictionary = existingScenes.map(item => ({
      name: item.name,
      aliases: item.aliases || [],
      description: item.description || '',
    }));
    const userPayload = {
      task: '从剧集大纲中抽离场景，能复用已有场景名就复用，不新增同义名称',
      existingScenes: existingDictionary,
      episodes: batch,
      outputSchema: {
        scenes: [{
          name: '场景主名',
          description: '环境描写',
          aliases: [ '别名1', '别名2' ],
          episodeNumbers: [ 1, 2 ],
        }],
      },
    };

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) },
    ];
  }

  parseAiScenes(rawText) {
    const cleaned = String(rawText || '').trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();
    if (!cleaned) return [];

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    let parsed = null;
    try {
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } else if (firstBracket !== -1 && lastBracket > firstBracket) {
        parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } else {
        parsed = JSON.parse(cleaned);
      }
    } catch (e) {
      throw new Error(`场景解析失败: ${e.message}`);
    }

    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.scenes)) return parsed.scenes;
    return [];
  }
}

module.exports = ScriptSceneService;
