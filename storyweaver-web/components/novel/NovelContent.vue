<template>
  <div class="script-content" ref="contentRef">
    <!-- 剧本标题 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'title' }"
      data-field="title"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:file-text" size="16" /></span>
        <h3 class="script-content__section-title">剧本标题</h3>
      </div>
      <input
        v-model="novelData.title"
        class="script-content__title-input"
        placeholder="输入剧本标题..."
      />
    </div>

    <!-- 创作资产（角色 + 场景） -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'characters' }"
      data-field="characters"
    >
      <NovelAssetPanel
        v-model="assetData"
        :character-cards="characterCards"
        :episodes="novelData.episodes"
        :project-id="scriptId"
        :api-base="apiBase"
        @update:character-cards="characterCards = $event"
      />
    </div>

    <!-- 故事线 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'storyline' }"
      data-field="storyline"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:git-branch" size="16" /></span>
        <h3 class="script-content__section-title">故事线</h3>
      </div>
      <div class="script-content__block">
        <textarea
          v-model="novelData.storyline"
          class="script-content__textarea"
          placeholder="小说故事线将由AI分析生成，包含总览、分阶段叙述、人物关系变化、伏笔、高潮节奏等..."
          rows="8"
        ></textarea>
      </div>
    </div>

    <!-- 分集内容区（大纲 / 剧本 / 分镜 Tab切换） -->
    <div
      class="script-content__section script-content__section--episodes"
      :class="{ 'script-content__section--ai-filling': aiFillingField.startsWith('episode') }"
      data-field="episodes"
    >
      <div class="script-content__section-header script-content__section-header--sticky">
        <span class="script-content__section-icon"><Icon name="lucide:clapperboard" size="16" /></span>
        <div class="script-content__tabs">
          <button
            v-for="tab in episodeTabs"
            :key="tab.key"
            class="script-content__tab"
            :class="{ 'script-content__tab--active': activeEpisodeTab === tab.key }"
            @click="activeEpisodeTab = tab.key"
          >
            <Icon :name="tab.icon" size="14" /> {{ tab.label }}
          </button>
        </div>

        <div class="script-content__tab-actions">
          <span v-if="activeEpisodeTab === 'outline'" class="script-content__tab-hint">通过创作助手来创作大纲 →</span>

          <template v-if="activeEpisodeTab === 'script'">
            <div v-if="isBatchGenerating" class="script-content__batch-status">
              <span class="script-content__batch-progress">正在生成 {{ batchProgress.current }}/{{ batchProgress.total }}</span>
              <button class="script-content__action-btn script-content__action-btn--danger" @click="emit('stop-batch-generate')">停止生成</button>
            </div>
            <div v-else class="script-content__batch-dropdown" @mouseenter="scriptDropdownVisible = true" @mouseleave="scriptDropdownVisible = false">
              <button class="script-content__action-btn script-content__action-btn--primary">批量生成</button>
              <div v-show="scriptDropdownVisible" class="script-content__batch-menu">
                <button class="script-content__batch-menu-item" @click="emit('batch-script-continue')">继续生成</button>
                <button class="script-content__batch-menu-item script-content__batch-menu-item--danger" @click="emit('batch-script-clear')">批量清空</button>
                <button class="script-content__batch-menu-item" @click="emit('batch-script-regenerate')">重新生成</button>
              </div>
            </div>
          </template>

        </div>

        <span class="script-content__section-badge">{{ novelData.episodes.length }}集</span>
      </div>

      <!-- 大纲Tab -->
      <div v-show="activeEpisodeTab === 'outline'" class="script-content__episodes">
        <div
          v-for="(ep, index) in novelData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{ 'script-content__episode--ai-filling': aiFillingField === `episode_${index + 1}` }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <input
              v-model="ep.title"
              class="script-content__episode-title-input"
              :placeholder="`第${index + 1}集标题...`"
            />
            <span v-if="ep.chapterRange && ep.chapterRange.length" class="outline-detail__chapter-range">
              章节 {{ ep.chapterRange[0] }}-{{ ep.chapterRange[ep.chapterRange.length - 1] }}
            </span>
            <button
              v-if="hasOutlineDetail(ep)"
              class="outline-detail__expand-btn"
              @click="openOutlineDrawer(index)"
            >
              <Icon name="lucide:panel-right-open" size="14" />
              展开详情
            </button>
          </div>

          <!-- 大纲正文 -->
          <textarea
            v-model="ep.content"
            class="script-content__textarea script-content__textarea--episode"
            :placeholder="`第${index + 1}集剧情大纲...`"
            rows="4"
          ></textarea>

          <!-- 无结构化数据时的提示 -->
          <div v-if="!ep.content && !hasOutlineDetail(ep)" class="outline-detail__empty">
            <Icon name="lucide:sparkles" size="14" />
            通过右侧创作助手与AI对话，生成本集大纲
          </div>
        </div>
        <button class="script-content__add-episode" @click="addEpisode">
          <span>+</span> 添加一集
        </button>
      </div>

      <!-- 剧本Tab -->
      <div v-show="activeEpisodeTab === 'script'" class="script-content__episodes">
        <div
          v-for="(ep, index) in novelData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{ 'script-content__episode--generating': generatingEpisodeIndex === index }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <span class="script-content__episode-title-text">{{ ep.title || '未命名' }}</span>
            <button
              v-if="generatingEpisodeIndex === index"
              class="script-content__action-btn script-content__action-btn--sm"
              @click="emit('stop-generate-script', index)"
            >停止</button>
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--primary script-content__action-btn--sm"
              :disabled="isGenerateBtnDisabled(ep, index)"
              @click="emit('generate-episode-script', index)"
            >{{ generateBtnText(ep, index) }}</button>
          </div>
          <textarea
            v-if="ep.scriptContent"
            v-model="ep.scriptContent"
            class="script-content__textarea script-content__textarea--episode script-content__textarea--script"
            placeholder="剧本内容..."
            rows="8"
            @input="emit('save-script-content', index)"
          ></textarea>
          <div v-else-if="generatingEpisodeIndex === index" class="script-content__episode-generating">
            正在生成剧本，请稍候...
          </div>
          <div v-else class="script-content__episode-empty">
            {{ ep.scriptStatus === 3 ? '台本生成失败，请点击"重试生成"' : '剧本未生成 — 请先确认大纲，点击"生成剧本"扩写为场景/对白/动作' }}
          </div>
        </div>
      </div>

      <!-- 分镜Tab -->
      <div v-show="activeEpisodeTab === 'storyboard'" class="script-content__episodes">
        <div class="script-content__storyboard-settings">
          <div class="script-content__setting-item">
            <label class="script-content__setting-label">画风风格</label>
            <select v-model="storyboardStyle" class="script-content__setting-select">
              <option v-for="option in artStyleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="script-content__setting-item">
            <label class="script-content__setting-label">画面比例</label>
            <select v-model="storyboardAspectRatio" class="script-content__setting-select">
              <option v-for="option in aspectRatioOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>

        <div
          v-for="(ep, index) in novelData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{
            'script-content__episode--generating': generatingStoryboardIndex === index || generatingVideoStoryboardIndex === index
          }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <span class="script-content__episode-title-text">{{ ep.title || '未命名' }}</span>
            <span v-if="ep.storyboardStatus === 2" class="script-content__storyboard-badge script-content__storyboard-badge--done">
              {{ ep.storyboardTotalShots || 0 }}个首帧镜头
            </span>
            <span
              v-if="ep.storyboardStatus === 2"
              class="script-content__storyboard-badge"
              :class="{
                'script-content__storyboard-badge--video': ep.videoStoryboardData?.shots?.length > 0,
                'script-content__storyboard-badge--video-empty': !ep.videoStoryboardData?.shots?.length,
                'script-content__storyboard-badge--video-generating': generatingVideoStoryboardIndex === index,
              }"
            >
              <template v-if="generatingVideoStoryboardIndex === index">
                视频生成中 {{ ep.videoStoryboardData?.shots?.length || 0 }}/{{ ep.storyboardTotalShots || 0 }}
              </template>
              <template v-else>
                {{ ep.videoStoryboardData?.shots?.length || 0 }}个视频镜头
              </template>
            </span>
            <button
              v-if="generatingStoryboardIndex === index"
              class="script-content__action-btn script-content__action-btn--danger script-content__action-btn--sm"
              @click="emit('stop-generate-storyboard', index)"
            >停止生成首帧</button>
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--primary script-content__action-btn--sm"
              :disabled="isStoryboardBtnDisabled(ep, index)"
              @click="emit('generate-storyboard', { index })"
            >{{ storyboardBtnText(ep, index) }}</button>
            <button
              v-if="generatingVideoStoryboardIndex === index"
              class="script-content__action-btn script-content__action-btn--danger script-content__action-btn--sm"
              @click="emit('stop-generate-video-storyboard', index)"
            >停止生成视频</button>
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--video script-content__action-btn--sm"
              :disabled="isVideoStoryboardBtnDisabled(ep, index)"
              @click="emit('generate-video-storyboard', { index })"
            >{{ videoStoryboardBtnText(ep, index) }}</button>
          </div>

          <div v-if="ep.storyboardData && ep.storyboardData.scenes" class="script-content__storyboard-scenes">
            <div
              v-for="(scene, sIdx) in ep.storyboardData.scenes"
              :key="sIdx"
              class="script-content__scene-block"
            >
              <div class="script-content__scene-header">
                <span class="script-content__scene-num">场景{{ scene.scene_number }}</span>
                <span class="script-content__scene-name">{{ scene.scene_name }}</span>
                <span class="script-content__scene-meta">{{ scene.scene_time }} / {{ scene.scene_location }}</span>
                <span class="script-content__scene-mood">{{ scene.scene_mood }}</span>
              </div>
              <div class="script-content__shot-list">
                <div
                  v-for="(shot, shotIdx) in scene.shots"
                  :key="shotIdx"
                  class="script-content__shot-card"
                  :class="{ 'script-content__shot-card--video-mode': getShotViewMode(index, sIdx, shotIdx) === 'video' }"
                >
                  <div class="script-content__shot-header">
                    <span class="script-content__shot-num">镜头{{ shot.shot_number }}</span>
                    <div class="script-content__shot-toggle">
                      <button
                        class="script-content__shot-toggle-btn"
                        :class="{ 'script-content__shot-toggle-btn--active': getShotViewMode(index, sIdx, shotIdx) === 'image' }"
                        @click="toggleShotViewMode(index, sIdx, shotIdx, 'image')"
                      ><Icon name="lucide:camera" size="14" /> 图片</button>
                      <button
                        class="script-content__shot-toggle-btn script-content__shot-toggle-btn--video"
                        :class="{
                          'script-content__shot-toggle-btn--active': getShotViewMode(index, sIdx, shotIdx) === 'video'
                        }"
                        @click="handleVideoToggle(index, sIdx, shotIdx)"
                      ><Icon name="lucide:video" size="14" /> 视频</button>
                    </div>
                    <template v-if="getShotViewMode(index, sIdx, shotIdx) === 'image'">
                      <span class="script-content__shot-type-tag">{{ shotTypeLabel(shot) }}</span>
                      <span class="script-content__shot-angle-tag">{{ shotAngleLabel(shot) }}</span>
                    </template>
                    <template v-else>
                      <span v-if="getVideoShot(index, shot.shot_number)" class="script-content__video-shot-time">{{ getVideoShot(index, shot.shot_number).time_range }}</span>
                      <span v-if="getVideoShot(index, shot.shot_number)" class="script-content__shot-type-tag">{{ getVideoShot(index, shot.shot_number).type_cn || getVideoShot(index, shot.shot_number).type }}</span>
                    </template>
                    <span class="script-content__shot-duration">{{ shot.duration }}s</span>
                  </div>

                  <!-- 图片镜头内容 -->
                  <div v-show="getShotViewMode(index, sIdx, shotIdx) === 'image'">
                    <div class="script-content__shot-desc">{{ shot.description }}</div>
                    <div v-if="shot.dialogue" class="script-content__shot-dialogue">{{ shot.dialogue }}</div>
                    <div v-if="shot.tags && shot.tags.length" class="script-content__shot-tags">
                      <span v-for="(tag, tIdx) in shot.tags" :key="tIdx" class="script-content__shot-tag">{{ tag }}</span>
                    </div>
                    <div v-if="shotPrompt(shot)" class="script-content__shot-prompt">
                      <span class="script-content__shot-prompt-label">
                        AI Prompt（可点击复制到即梦等平台）
                        <span v-if="copiedShotKey === `${sIdx}-${shotIdx}`" class="script-content__copied-tip">✓ 已复制</span>
                      </span>
                      <div class="script-content__shot-prompt-text" @click="copyPrompt(transformPrompt(shotPrompt(shot)), `${sIdx}-${shotIdx}`)">
                        {{ transformPrompt(shotPrompt(shot)) }}
                      </div>
                    </div>
                  </div>

                  <!-- 视频镜头内容 -->
                  <div v-show="getShotViewMode(index, sIdx, shotIdx) === 'video'">
                    <template v-if="getVideoShot(index, shot.shot_number)">
                      <div class="script-content__video-shot-camera">
                        <span class="script-content__video-shot-camera-label">运镜</span>
                        <span>{{ getVideoShot(index, shot.shot_number).camera_cn || getVideoShot(index, shot.shot_number).camera }}</span>
                      </div>
                      <div class="script-content__shot-desc">{{ getVideoShot(index, shot.shot_number).visual }}</div>
                      <div v-if="getVideoShot(index, shot.shot_number).keyframes && getVideoShot(index, shot.shot_number).keyframes.length" class="script-content__video-keyframes">
                        <div class="script-content__video-keyframes-label">关键帧</div>
                        <div
                          v-for="(kf, kfIdx) in getVideoShot(index, shot.shot_number).keyframes"
                          :key="kfIdx"
                          class="script-content__video-keyframe-item"
                        >
                          <span class="script-content__video-keyframe-time">{{ kf.time }}</span>
                          <span>{{ kf.state }}</span>
                        </div>
                      </div>
                      <div v-if="getVideoShot(index, shot.shot_number).audio && getVideoShot(index, shot.shot_number).audio !== 'None'" class="script-content__shot-dialogue">
                        {{ getVideoShot(index, shot.shot_number).audio }}
                      </div>
                      <div v-if="getVideoShot(index, shot.shot_number).transition && getVideoShot(index, shot.shot_number).transition !== 'End'" class="script-content__video-transition">
                        转场：{{ getVideoShot(index, shot.shot_number).transition }}
                      </div>
                      <div v-if="getVideoShot(index, shot.shot_number).prompt" class="script-content__shot-prompt">
                        <span class="script-content__shot-prompt-label">
                          视频提示词（可点击复制到Sora/可灵等平台）
                          <span v-if="copiedShotKey === `video-${index}-${shotIdx}`" class="script-content__copied-tip">✓ 已复制</span>
                        </span>
                        <div class="script-content__shot-prompt-text" @click="copyPrompt(transformPrompt(getVideoShot(index, shot.shot_number).prompt), `video-${index}-${shotIdx}`)">
                          {{ transformPrompt(getVideoShot(index, shot.shot_number).prompt) }}
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div v-if="generatingVideoStoryboardIndex === index" class="script-content__shot-video-generating">
                        正在生成视频分镜头提示词...请耐心等待1~3分钟
                      </div>
                      <div v-else class="script-content__shot-video-empty">
                        <div class="script-content__shot-video-empty-text">
                          视频分镜未生成 — 点击右上角"生成视频分镜"按钮
                        </div>
                        <button
                          class="script-content__action-btn script-content__action-btn--video"
                          :disabled="isVideoStoryboardBtnDisabled(novelData.episodes[index], index)"
                          @click="emit('generate-video-storyboard', { index })"
                        >
                          <Icon name="lucide:video" size="14" /> 直接生成
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="generatingStoryboardIndex === index" class="script-content__episode-generating">
            正在生成首帧分镜头提示词...请耐心等待1~3分钟
          </div>
          <div v-else class="script-content__episode-empty">
            {{ storyboardEmptyText(ep) }}
          </div>
        </div>
      </div>

    </div>

    <!-- 大纲详情抽屉 -->
    <NovelOutlineDrawer
      :visible="outlineDrawerIndex >= 0"
      :episode="outlineDrawerEpisode"
      :episode-index="outlineDrawerIndex"
      :character-cards="characterCards"
      @close="outlineDrawerIndex = -1"
    />
  </div>
</template>

<script setup>
/**
 * 小说编辑 - 内容区组件
 * 从 ScriptContent 改造：去掉剧情梗概/情绪点，plotLines→storyline，basicInfo→参数卡片
 * 保留完整的分集Tab（大纲/剧本/分镜）逻辑
 */
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      title: '',
      basicInfo: { episodes: 80, duration: 2, gender: '男频', totalChapters: 0, totalWords: 0, genres: [] },
      characters: '',
      storyline: '',
      artStyle: '日系动漫',
      aspectRatio: '9:16',
      episodes: [
        { title: '', content: '', outlineDetail: null, chapterRange: [], scriptContent: '', scriptStatus: 0, scriptLocked: 0, storyboardData: null, storyboardStatus: 0, storyboardTotalShots: 0, videoStoryboardData: null, videoStoryboardStatus: 0, videoStoryboardTotalShots: 0 },
      ],
    }),
  },
  assets: { type: Object, default: () => ({ characters: [], scenes: [] }) },
  aiFillingField: { type: String, default: '' },
  generatingEpisodeIndex: { type: Number, default: -1 },
  generatingStoryboardIndex: { type: Number, default: -1 },
  generatingVideoStoryboardIndex: { type: Number, default: -1 },
  isBatchGenerating: { type: Boolean, default: false },
  batchProgress: { type: Object, default: () => ({ current: 0, total: 0 }) },
  characterCards: { type: Array, default: () => [] },
  scriptId: { type: String, default: '' },
  apiBase: { type: String, default: '' },
})

const emit = defineEmits([
  'update:modelValue',
  'update:assets',
  'update:characterCards',
  'generate-episode-script',
  'stop-generate-script',
  'save-script-content',
  'batch-script-continue',
  'batch-script-clear',
  'batch-script-regenerate',
  'stop-batch-generate',
  'generate-storyboard',
  'stop-generate-storyboard',
  'batch-storyboard-continue',
  'batch-storyboard-clear',
  'batch-storyboard-regenerate',
  'save-storyboard',
  'generate-video-storyboard',
  'stop-generate-video-storyboard',
  'batch-video-storyboard-continue',
  'batch-video-storyboard-clear',
  'batch-video-storyboard-regenerate',
  'save-video-storyboard',
  'parse-characters',
  'save-characters',
])

const novelData = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const characterCards = computed({
  get: () => props.characterCards,
  set: (val) => emit('update:characterCards', val),
})

/* 资产管理双向绑定 */
const assetData = computed({
  get: () => props.assets,
  set: (val) => emit('update:assets', val),
})

/* AI填充时自动滚动 */
const contentRef = ref(null)

const scrollToField = (field) => {
  if (!field || !contentRef.value) return

  if (field.startsWith('episode_')) {
    const episodeIndex = parseInt(field.replace('episode_', ''), 10)
    if (isNaN(episodeIndex)) return
    const episodesSection = contentRef.value.querySelector('[data-field="episodes"]')
    if (!episodesSection) return
    if (activeEpisodeTab.value !== 'outline') {
      activeEpisodeTab.value = 'outline'
    }
    nextTick(() => {
      const episodeCards = episodesSection.querySelectorAll('.script-content__episode')
      const targetEpisode = episodeCards[episodeIndex - 1]
      if (targetEpisode) {
        scrollElementIntoView(targetEpisode)
      }
    })
    return
  }

  const target = contentRef.value.querySelector(`[data-field="${field}"]`)
  if (target) {
    scrollElementIntoView(target)
  }
}

const scrollElementIntoView = (element) => {
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
}

watch(() => props.aiFillingField, (newField) => {
  if (newField) {
    nextTick(() => { scrollToField(newField) })
  }
})

/* Tab 切换 */
const episodeTabs = [
  { key: 'outline', label: '大纲', icon: 'lucide:clipboard-list' },
  { key: 'script', label: '剧本', icon: 'lucide:file-text' },
  { key: 'storyboard', label: '分镜', icon: 'lucide:clapperboard' },
]
const activeEpisodeTab = ref('outline')
const scriptDropdownVisible = ref(false)

/* 大纲详情抽屉 */
const outlineDrawerIndex = ref(-1)
const outlineDrawerEpisode = computed(() => {
  if (outlineDrawerIndex.value < 0 || outlineDrawerIndex.value >= novelData.value.episodes.length) return null
  return novelData.value.episodes[outlineDrawerIndex.value]
})
const openOutlineDrawer = (index) => {
  outlineDrawerIndex.value = index
}
const hasOutlineDetail = (ep) => {
  const d = ep.outlineDetail
  if (!d) return false
  return !!(d.coreConflict || d.openingHook || d.endingHook || d.emotionalCurve ||
    (d.keyEvents && d.keyEvents.length) ||
    (d.visualHighlights && d.visualHighlights.length) ||
    (d.classicQuotes && d.classicQuotes.length) ||
    (d.characters && d.characters.length) ||
    (d.scenes && d.scenes.length) ||
    (d.props && d.props.length))
}

/* 分镜画风 */
const { artStyleOptions, aspectRatioOptions } = useStyleConfig()
const styleOptions = computed(() => artStyleOptions.map(item => item.value))
const storyboardStyle = ref(novelData.value?.artStyle || '日系动漫')
const storyboardAspectRatio = ref(novelData.value?.aspectRatio || '9:16')
let _skipWatch = false

/* 镜头视图模式 */
const shotViewMode = reactive({})
const getShotViewMode = (epIndex, sceneIdx, shotIdx) => shotViewMode[`${epIndex}-${sceneIdx}-${shotIdx}`] || 'image'
const toggleShotViewMode = (epIndex, sceneIdx, shotIdx, mode) => { shotViewMode[`${epIndex}-${sceneIdx}-${shotIdx}`] = mode }
const handleVideoToggle = (epIndex, sceneIdx, shotIdx) => { toggleShotViewMode(epIndex, sceneIdx, shotIdx, 'video') }

const videoShotMap = computed(() => {
  const map = {}
  for (let i = 0; i < (novelData.value.episodes || []).length; i++) {
    const ep = novelData.value.episodes[i]
    if (!ep.videoStoryboardData?.shots) continue
    const shotMap = {}
    for (const shot of ep.videoStoryboardData.shots) { shotMap[shot.shot_number] = shot }
    map[i] = shotMap
  }
  return map
})
const getVideoShot = (epIndex, shotNumber) => videoShotMap.value[epIndex]?.[shotNumber] || null

/* 风格/比例替换 */
const STYLE_TAGS_MAP = {
  '日系动漫': '日系动漫风格，赛璐璐上色，鲜艳色彩，2D美学',
  '国风水墨': '中国水墨画风格，空灵，极简，传统国画',
  '赛博朋克': '赛博朋克风格，霓虹灯光，高对比度，未来科技',
  '电影写实': '电影级写实风格，胶片质感，戏剧性光影',
  '3D渲染': '3D渲染风格，体积光，光线追踪，高精度建模',
  '仙侠古风': '仙侠古风风格，中国古代奇幻，神秘空灵，2D电影感',
  '欧美卡通': '欧美卡通风格，粗线条，夸张特征',
  '韩漫风格': '韩漫风格，柔和阴影，精致眼部，浪漫氛围',
}
const RATIO_TARGET = { '16:9': '横屏构图，16:9宽画幅', '9:16': '竖屏构图，9:16竖画幅', '1:1': '方形构图，1:1画幅' }
const STYLE_PATTERNS = {
  '日系动漫': /日系动漫[风格]*[，,\s]*(?:赛璐[璐珞][上着]色[，,\s]*)?(?:鲜艳色彩[，,\s]*)?(?:2D美学)?/g,
  '国风水墨': /中国水墨[画风]*[格]*[，,\s]*(?:空灵[，,\s]*)?(?:极简[，,\s]*)?(?:传统国画)?/g,
  '赛博朋克': /赛博朋克[风格]*[，,\s]*(?:霓虹[灯光]*[，,\s]*)?(?:高对比度[，,\s]*)?(?:未来科技)?/g,
  '电影写实': /电影[级]?写实[风格]*[，,\s]*(?:胶片质感[，,\s]*)?(?:戏剧性光影)?/g,
  '3D渲染': /3[Dd]渲染[风格]*[，,\s]*(?:体积光[，,\s]*)?(?:光线追踪[，,\s]*)?(?:高精度建模)?/g,
  '仙侠古风': /仙侠古风[风格]*[，,\s]*(?:中国古代奇幻[，,\s]*)?(?:神秘空灵[，,\s]*)?(?:2D电影感)?/g,
  '欧美卡通': /欧美卡通[风格]*[，,\s]*(?:粗线条[，,\s]*)?(?:夸张特征)?/g,
  '韩漫风格': /韩漫[风格]*[，,\s]*(?:柔和阴影[，,\s]*)?(?:精致眼部[，,\s]*)?(?:浪漫氛围)?/g,
}
const RATIO_PATTERN = /[横竖方][屏形]?构图[，,\s]*(?:\d+:\d+)?[宽竖]?画幅?|\d+:\d+[，,\s]*(?:[横竖方][屏形]?构图?|[宽竖]?画幅)/g

const transformPrompt = (rawPrompt) => {
  if (!rawPrompt) return ''
  const targetStyle = storyboardStyle.value
  const targetRatio = storyboardAspectRatio.value
  const targetStyleTags = STYLE_TAGS_MAP[targetStyle]
  const targetRatioLabel = RATIO_TARGET[targetRatio]
  let result = rawPrompt
  if (targetStyleTags) {
    for (const [styleName, pattern] of Object.entries(STYLE_PATTERNS)) {
      if (styleName === targetStyle) continue
      pattern.lastIndex = 0
      if (pattern.test(result)) { pattern.lastIndex = 0; result = result.replace(pattern, targetStyleTags); break }
    }
  }
  if (targetRatioLabel) {
    RATIO_PATTERN.lastIndex = 0
    if (RATIO_PATTERN.test(result)) { RATIO_PATTERN.lastIndex = 0; result = result.replace(RATIO_PATTERN, targetRatioLabel) }
  }
  return result
}

watch(storyboardStyle, async (newStyle) => {
  if (_skipWatch) return
  try {
    const config = useRuntimeConfig()
    const token = localStorage.getItem('token')
    novelData.value = { ...novelData.value, artStyle: newStyle }
    await $fetch(`${config.public.apiBase}/api/novel-project/${props.scriptId}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: { art_style: newStyle },
    })
  } catch (e) { console.error('更新画风失败:', e) }
})

watch(storyboardAspectRatio, async (newRatio) => {
  if (_skipWatch) return
  try {
    const config = useRuntimeConfig()
    const token = localStorage.getItem('token')
    novelData.value = { ...novelData.value, aspectRatio: newRatio }
    await $fetch(`${config.public.apiBase}/api/novel-project/${props.scriptId}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: { aspect_ratio: newRatio },
    })
  } catch (e) { console.error('更新比例失败:', e) }
})

watch(
  () => [novelData.value?.artStyle, novelData.value?.aspectRatio],
  ([newStyle, newRatio]) => {
    if (_skipWatch) return
    const shouldSyncStyle = newStyle && newStyle !== storyboardStyle.value
    const shouldSyncRatio = newRatio && newRatio !== storyboardAspectRatio.value
    if (!shouldSyncStyle && !shouldSyncRatio) return
    _skipWatch = true
    if (shouldSyncStyle) storyboardStyle.value = newStyle
    if (shouldSyncRatio) storyboardAspectRatio.value = newRatio
    nextTick(() => { _skipWatch = false })
  },
)

/* 景别映射 */
const SHOT_TYPE_MAP = { extreme_wide: '大远景', wide: '远景', full: '全景', medium: '中景', close_up: '近景', extreme_close_up: '特写', macro: '大特写' }
const ANGLE_MAP = { eye_level: '平视', high_angle: '俯拍', low_angle: '仰拍', dutch_angle: '荷兰角', over_shoulder: '过肩', pov: '主观', birds_eye: '鸟瞰' }
const shotTypeLabel = (shot) => { const val = shot.shot_type || shot.shot_type_code || ''; return SHOT_TYPE_MAP[val] || val }
const shotAngleLabel = (shot) => { const val = shot.camera_angle || shot.camera_angle_code || ''; return ANGLE_MAP[val] || val }
const shotPrompt = (shot) => shot.prompt || shot.prompt_en || shot.prompt_cn || ''

/* 分镜按钮逻辑 */
const isStoryboardBtnDisabled = (ep, index) => {
  if (!ep.scriptContent || !ep.scriptContent.trim()) return true
  if (props.generatingStoryboardIndex >= 0) return true
  if (props.generatingVideoStoryboardIndex === index) return true
  return false
}
const storyboardBtnText = (ep, index) => {
  if (props.generatingStoryboardIndex === index) return '生成中...'
  if (ep.storyboardStatus === 2 && ep.storyboardData) return '重新生成首帧'
  if (ep.storyboardStatus === 3) return '重试生成首帧'
  return '生成首帧分镜'
}
const storyboardEmptyText = (ep) => {
  if (!ep.scriptContent || !ep.scriptContent.trim()) return '请先生成剧本，再生成分镜头提示词'
  if (ep.storyboardStatus === 3) return '分镜生成失败，请点击"重试生成"'
  return '首帧分镜未生成 — 点击"生成首帧分镜"将台本拆解为AI动漫分首帧镜头提示词'
}
const isVideoStoryboardBtnDisabled = (ep, index) => {
  if (!ep.storyboardData || !ep.storyboardData.scenes) return true
  if (ep.storyboardStatus !== 2) return true
  if (props.generatingVideoStoryboardIndex >= 0) return true
  return false
}
const videoStoryboardBtnText = (ep, index) => {
  if (props.generatingVideoStoryboardIndex === index) return '生成中...'
  if (ep.videoStoryboardStatus === 2 && ep.videoStoryboardData) return '重新生成视频'
  if (ep.videoStoryboardStatus === 3) return '重试生成视频'
  return '生成视频分镜'
}

/* 复制提示词 */
const copiedShotKey = ref('')
let _copiedTimer = null
const copyPrompt = async (text, shotKey) => {
  if (!text) return
  try { await navigator.clipboard.writeText(text) } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }
  copiedShotKey.value = shotKey
  clearTimeout(_copiedTimer)
  _copiedTimer = setTimeout(() => { copiedShotKey.value = '' }, 2000)
}

/* 添加集 */
const addEpisode = () => {
  const updated = { ...props.modelValue }
  updated.episodes = [...updated.episodes, { title: '', content: '', outlineDetail: null, chapterRange: [], scriptContent: '', scriptStatus: 0, scriptLocked: 0, storyboardData: null, storyboardStatus: 0, storyboardTotalShots: 0, videoStoryboardData: null, videoStoryboardStatus: 0, videoStoryboardTotalShots: 0 }]
  emit('update:modelValue', updated)
}

/* 台本按钮逻辑 */
const isGenerateBtnDisabled = (ep, index) => {
  if (!ep.content || !ep.content.trim()) return true
  if (props.generatingEpisodeIndex >= 0) return true
  return false
}
const generateBtnText = (ep, index) => {
  if (props.generatingEpisodeIndex === index) return '生成中...'
  if (ep.scriptStatus === 2 && ep.scriptContent) return '重新生成'
  if (ep.scriptStatus === 3) return '重试生成'
  return '生成剧本'
}

const setStoryboardSettings = (style, aspectRatio) => {
  _skipWatch = true
  const validStyleOptions = styleOptions.value
  if (style && validStyleOptions.includes(style)) storyboardStyle.value = style
  if (aspectRatio && ['16:9', '9:16', '1:1'].includes(aspectRatio)) storyboardAspectRatio.value = aspectRatio
  novelData.value = {
    ...novelData.value,
    artStyle: storyboardStyle.value,
    aspectRatio: storyboardAspectRatio.value,
  }
  nextTick(() => { _skipWatch = false })
}

const switchShotsToVideo = (epIndex, videoShots) => {
  const ep = novelData.value.episodes[epIndex]
  if (!ep?.storyboardData?.scenes) return
  const scenes = ep.storyboardData.scenes
  for (const vs of videoShots) {
    const shotNum = vs.shot_number
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const shots = scenes[sIdx].shots || []
      for (let shotIdx = 0; shotIdx < shots.length; shotIdx++) {
        if (shots[shotIdx].shot_number === shotNum) { shotViewMode[`${epIndex}-${sIdx}-${shotIdx}`] = 'video' }
      }
    }
  }
}

const switchAllShotsToVideo = (epIndex) => {
  const ep = novelData.value.episodes[epIndex]
  if (!ep?.storyboardData?.scenes) return
  const scenes = ep.storyboardData.scenes
  for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
    const shots = scenes[sIdx].shots || []
    for (let shotIdx = 0; shotIdx < shots.length; shotIdx++) { shotViewMode[`${epIndex}-${sIdx}-${shotIdx}`] = 'video' }
  }
}

defineExpose({
  setStoryboardSettings,
  switchShotsToVideo,
  switchAllShotsToVideo,
  scrollToField,
  scrollToEpisode: (index) => scrollToField(`episode_${index + 1}`),
})
</script>

<style scoped>
.script-content { display: flex; flex-direction: column; gap: 20px; }
.script-content__section { background: var(--color-bg-white); border-radius: var(--radius); border: 1px solid var(--color-border); padding: 20px; overflow: hidden; }
.script-content__section--episodes { overflow: visible; }
.script-content__section-header--sticky { position: sticky; top: 0; z-index: 10; background: var(--color-bg-white); margin: -20px -20px 0; padding: 16px 20px 12px; border-bottom: 1px solid var(--color-border-light); border-radius: var(--radius) var(--radius) 0 0; }
.script-content__section--episodes .script-content__episodes { margin-top: 14px; }
.script-content__section-header { display: flex; align-items: center; gap: 8px; z-index: 20; margin-bottom: 14px; }
.script-content__section-icon { font-size: 18px; }
.script-content__section-title { font-size: 15px; font-weight: 700; color: var(--color-text); }
.script-content__section-badge { padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: var(--color-bg); color: var(--color-text-secondary); flex-shrink: 0; }
.script-content__title-input { width: 100%; min-width: 0; box-sizing: border-box; padding: 12px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 18px; font-weight: 700; color: var(--color-text); background: var(--color-bg); outline: none; transition: border-color 0.2s; overflow: hidden; text-overflow: ellipsis; }
.script-content__title-input:focus { border-color: var(--color-primary); background: var(--color-bg-white); box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08); }
.script-content__textarea { width: 100%; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; line-height: 1.8; color: var(--color-text); background: var(--color-bg); resize: vertical; outline: none; transition: border-color 0.2s; font-family: inherit; }
.script-content__textarea:focus { border-color: var(--color-primary); background: var(--color-bg-white); box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08); }
.script-content__textarea::placeholder { color: var(--color-text-light); }
.script-content__episodes { display: flex; flex-direction: column; gap: 12px; }

/* 参数卡片 */
.script-content__info-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.script-content__info-card { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: var(--color-bg); border-radius: var(--radius-sm); border: 1px solid var(--color-border-light); transition: border-color 0.2s; }
.script-content__info-card:hover { border-color: var(--color-border); }
.script-content__info-card--wide { grid-column: span 3; }
.script-content__info-label { font-size: 12px; color: var(--color-text-light); white-space: nowrap; }
.script-content__info-value { font-size: 13px; font-weight: 600; color: var(--color-text); margin-left: auto; }

/* Tab */
.script-content__tabs { display: flex; gap: 4px; background: var(--color-bg); border-radius: 8px; padding: 3px; }
.script-content__tab { padding: 5px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: transparent; border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.script-content__tab:hover { color: var(--color-text); background: var(--color-bg-white); }
.script-content__tab--active { color: var(--color-primary); background: var(--color-bg-white); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); font-weight: 600; }
.script-content__tab-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.script-content__tab-hint { font-size: 12px; color: var(--color-text-light); white-space: nowrap; }
.script-content__batch-dropdown { position: relative; }
.script-content__batch-dropdown > .script-content__action-btn { padding: 2px 10px; font-size: 11px; font-weight: 500; border-radius: 6px; line-height: inherit; }
.script-content__batch-menu { position: absolute; top: 100%; right: 0; margin-top: 0; background: var(--color-bg-white); border: 1px solid var(--color-border); border-radius: var(--radius-sm); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); z-index: 20; min-width: 80px; padding: 3px 0; }
.script-content__batch-menu::before { content: ''; position: absolute; top: -8px; left: 0; right: 0; height: 8px; }
.script-content__batch-menu-item { display: block; width: 100%; padding: 4px 12px; font-size: 11px; color: var(--color-text); background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.15s; white-space: nowrap; }
.script-content__batch-menu-item:hover { background: var(--color-bg); }
.script-content__batch-menu-item--danger { color: #e53935; }
.script-content__batch-menu-item--danger:hover { background: #fef2f2; }
.script-content__batch-status { display: flex; align-items: center; gap: 8px; }
.script-content__batch-progress { font-size: 11px; color: var(--color-primary); font-weight: 500; white-space: nowrap; }

/* 操作按钮 */
.script-content__action-btn { padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); background: var(--color-bg-white); border: 1px solid var(--color-border); cursor: pointer; transition: all 0.2s; }
.script-content__action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.script-content__action-btn--primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.script-content__action-btn--primary:hover:not(:disabled) { opacity: 0.9; color: #fff; }
.script-content__action-btn--sm { padding: 2px 10px; font-size: 11px; flex-shrink: 0; }
.script-content__action-btn--danger { background: #e53935; color: #fff; border: none; padding: 2px 10px; font-size: 11px; font-weight: 500; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
.script-content__action-btn--danger:hover { background: #c62828; }
.script-content__action-btn--video { background: #8b5cf6; color: #fff; border-color: #8b5cf6; }
.script-content__action-btn--video:hover:not(:disabled) { opacity: 0.9; color: #fff; }

/* 剧集 */
.script-content__episode { background: var(--color-bg); border-radius: var(--radius-sm); padding: 0 14px 14px 14px; border: 1px solid var(--color-border-light); transition: border-color 0.2s; }
.script-content__episode:hover { border-color: var(--color-border); }
.script-content__episode-header { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; padding-top: 14px; position: sticky; top: 63px; background: var(--color-bg); z-index: 10; }
.script-content__episode-num { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: var(--color-primary); color: #fff; white-space: nowrap; }
.script-content__episode-title-input { flex: 1; padding: 6px 10px; border: 1px solid transparent; border-radius: var(--radius-xs); font-size: 13px; font-weight: 600; color: var(--color-text); background: transparent; outline: none; transition: all 0.2s; }
.script-content__episode-title-input:focus { border-color: var(--color-border); background: var(--color-bg-white); }
.script-content__episode-title-text { flex: 1; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.script-content__textarea--episode { background: var(--color-bg-white); }
.script-content__add-episode { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border: 2px dashed var(--color-border); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: transparent; transition: all 0.2s; cursor: pointer; }
.script-content__add-episode:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.script-content__episode-empty { font-size: 12px; color: var(--color-text-light); line-height: 1.6; padding: 12px 14px; background: var(--color-bg-white); border-radius: var(--radius-xs); border: 1px dashed var(--color-border-light); }
.script-content__episode-generating { font-size: 12px; color: var(--color-primary); line-height: 1.6; padding: 12px 14px; margin-top: 14px; background: var(--color-primary-bg); border-radius: var(--radius-xs); border: 1px solid var(--color-primary); animation: ai-fill-pulse 1.5s ease-in-out infinite; }
.script-content__episode--generating { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1); }

/* 锁定按钮 */
.script-content__lock-btn { margin-left: auto; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; white-space: nowrap; line-height: 1.6; }
.script-content__lock-btn--empty { background: var(--color-bg); color: var(--color-text-light); cursor: not-allowed; border-color: var(--color-border-light); }
.script-content__lock-btn--unlocked { background: var(--color-bg); color: var(--color-text-secondary); border-color: var(--color-border); }
.script-content__lock-btn--unlocked:hover { background: #fff3e0; color: var(--color-primary); border-color: var(--color-primary); }
.script-content__lock-btn--locked { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.script-content__lock-btn--locked:hover { opacity: 0.85; }
.script-content__lock-btn--episode { flex-shrink: 0; font-size: 10px; padding: 1px 8px; }

/* AI填充高亮 */
.script-content__section--ai-filling { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12); animation: ai-fill-pulse 1.5s ease-out; }
.script-content__episode--ai-filling { border-color: var(--color-primary); background: var(--color-primary-bg); animation: ai-fill-pulse 1.5s ease-out; }
@keyframes ai-fill-pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.3); } 50% { box-shadow: 0 0 0 6px rgba(255, 107, 53, 0.15); } 100% { box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12); } }

/* 分镜 */
.script-content__storyboard-settings { display: flex; gap: 16px; padding: 12px 16px; background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: 14px; }
.script-content__setting-item { display: flex; align-items: center; gap: 6px; }
.script-content__setting-label { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.script-content__setting-select { padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text); background: var(--color-bg-white); outline: none; cursor: pointer; }
.script-content__setting-select:focus { border-color: var(--color-primary); }
.script-content__storyboard-badge { padding: 1px 8px; border-radius: 10px; font-size: 10px; font-weight: 500; }
.script-content__storyboard-badge--done { background: #e8f5e9; color: #2e7d32; }
.script-content__storyboard-badge--video { background: #eee4f8; color: #8b5cf6; }
.script-content__storyboard-badge--video-empty { background: #f0f0f0; color: #999; }
.script-content__storyboard-badge--video-generating { background: #eee4f8; color: #8b5cf6; animation: badge-pulse 1.5s ease-in-out infinite; }
@keyframes badge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.script-content__storyboard-scenes { display: flex; flex-direction: column; gap: 16px; }
.script-content__scene-block { border: 1px solid var(--color-border-light); border-radius: var(--radius-sm); overflow: hidden; }
.script-content__scene-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--color-bg); border-bottom: 1px solid var(--color-border-light); flex-wrap: wrap; }
.script-content__scene-num { font-size: 12px; font-weight: 600; color: var(--color-primary); }
.script-content__scene-name { font-size: 12px; font-weight: 600; color: var(--color-text); }
.script-content__scene-meta { font-size: 11px; color: var(--color-text-light); }
.script-content__scene-mood { font-size: 11px; color: var(--color-text-secondary); margin-left: auto; font-style: italic; }
.script-content__shot-list { display: flex; flex-direction: column; gap: 1px; background: var(--color-border-light); }
.script-content__shot-card { padding: 10px 12px; background: var(--color-bg-white); }
.script-content__shot-card--video-mode { border-color: #d8b4fe; background: #faf5ff; }
.script-content__shot-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.script-content__shot-num { font-size: 11px; font-weight: 600; color: var(--color-primary); background: rgba(255, 107, 53, 0.08); padding: 1px 6px; border-radius: 4px; }
.script-content__shot-type-tag { font-size: 10px; padding: 1px 8px; border-radius: 4px; background: #e3f2fd; color: #1565c0; font-weight: 600; font-family: monospace; letter-spacing: 0.3px; }
.script-content__shot-angle-tag { font-size: 10px; padding: 1px 8px; border-radius: 4px; background: #f3e5f5; color: #7b1fa2; font-family: monospace; letter-spacing: 0.3px; }
.script-content__shot-duration { font-size: 10px; color: var(--color-text-light); margin-left: auto; }
.script-content__shot-desc { font-size: 13px; color: var(--color-text); line-height: 1.7; margin-bottom: 6px; }
.script-content__shot-dialogue { font-size: 12px; color: #d84315; padding: 4px 8px; background: #fff3e0; border-radius: 4px; margin-bottom: 6px; border-left: 2px solid #ff9800; }
.script-content__shot-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.script-content__shot-tag { font-size: 10px; color: var(--color-text-secondary); padding: 1px 6px; background: var(--color-bg); border-radius: 3px; border: 1px solid var(--color-border-light); }
.script-content__shot-prompt { margin-top: 8px; border-top: 1px dashed var(--color-border-light); padding-top: 6px; }
.script-content__shot-prompt-label { font-size: 10px; font-weight: 600; color: #2e7d32; margin-bottom: 3px; display: block; }
.script-content__shot-prompt-text { font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; padding: 6px 8px; background: #f1f8e9; border-radius: 4px; cursor: pointer; transition: background 0.2s; word-break: break-all; }
.script-content__shot-prompt-text:hover { background: #dcedc8; }
.script-content__copied-tip { color: #2e7d32; font-weight: 500; font-size: 11px; margin-left: 6px; animation: copiedFadeIn 0.2s ease; }
@keyframes copiedFadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }

/* 视频分镜 */
.script-content__video-shot-time { font-size: 11px; color: #8b5cf6; background: #f5f3ff; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.script-content__video-shot-camera { font-size: 12px; color: #555; display: flex; align-items: center; gap: 6px; }
.script-content__video-shot-camera-label { font-size: 10px; color: #fff; background: #8b5cf6; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.script-content__video-keyframes { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
.script-content__video-keyframes-label { font-size: 10px; color: #8b5cf6; font-weight: 600; margin-bottom: 2px; }
.script-content__video-keyframe-item { font-size: 11px; color: #555; display: flex; gap: 8px; line-height: 1.5; }
.script-content__video-keyframe-time { font-size: 10px; color: #8b5cf6; background: #f5f3ff; padding: 0 4px; border-radius: 3px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.script-content__video-transition { font-size: 11px; color: #888; font-style: italic; padding-top: 4px; border-top: 1px dashed #eee; }
.script-content__shot-toggle { display: flex; gap: 0; background: #f0f0f0; border-radius: 6px; padding: 2px; flex-shrink: 0; }
.script-content__shot-toggle-btn { padding: 2px 8px; font-size: 11px; font-weight: 500; border: none; border-radius: 4px; cursor: pointer; background: transparent; color: var(--color-text-light); transition: all 0.2s; line-height: 14px; white-space: nowrap; }
.script-content__shot-toggle-btn:hover:not(:disabled) { color: var(--color-text); background: rgba(255, 255, 255, 0.6); }
.script-content__shot-toggle-btn--active { background: var(--color-primary); color: #fff; box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3); }
.script-content__shot-toggle-btn--active:hover:not(:disabled) { background: var(--color-primary); color: #fff; }
.script-content__shot-toggle-btn--video.script-content__shot-toggle-btn--active { background: #8b5cf6; color: #fff; box-shadow: 0 1px 3px rgba(139, 92, 246, 0.3); }
.script-content__shot-toggle-btn--video.script-content__shot-toggle-btn--active:hover:not(:disabled) { background: #8b5cf6; color: #fff; }
.script-content__shot-video-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 12px; background: #faf5ff; border: 1px dashed #d8b4fe; border-radius: 6px; text-align: center; }
.script-content__shot-video-empty-text { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; }
.script-content__shot-video-generating { padding: 16px 12px; background: #f5f3ff; border: 1px solid #d8b4fe; border-radius: 6px; font-size: 12px; color: #8b5cf6; text-align: center; animation: ai-fill-pulse 1.5s ease-in-out infinite; }

/* ========================================
 * 大纲结构化详情（对齐Toonflow多维度展示）
 * ======================================== */
.outline-detail__chapter-range { font-size: 11px; color: var(--color-text-light); background: var(--color-bg); padding: 2px 8px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }
.outline-detail__expand-btn { display: flex; align-items: center; gap: 3px; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; color: var(--color-text-secondary); background: var(--color-bg); border: 1px solid var(--color-border-light); cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
.outline-detail__expand-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(255, 107, 53, 0.04); }
.outline-detail__empty { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 20px 14px; font-size: 12px; color: var(--color-text-light); background: var(--color-bg-white); border-radius: var(--radius-xs); border: 1px dashed var(--color-border-light); margin-top: 4px; }
</style>
