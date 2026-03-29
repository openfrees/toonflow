<template>
  <div class="script-preview">
    <h3 class="script-preview__title">
      <Icon name="lucide:clipboard-list" class="script-preview__title-icon" size="16" style="vertical-align: middle;" />
      剧本细节
    </h3>
    <p class="script-preview__desc">根据你的参数设置，AI将按以下规格生成剧本</p>

    <!-- 集数 + 每集时长（同行） -->
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:clapperboard" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">集数</span>
          <span class="script-preview__card-value">{{ params.episodes }}集</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:clock" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">每集时长</span>
          <span class="script-preview__card-value">{{ params.duration }}分钟</span>
        </div>
      </div>
    </div>

    <!-- 高级参数 -->
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:user" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">角色上限</span>
          <span class="script-preview__card-value">{{ advancedParams.maxRoles }}人</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:drama" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">场景上限</span>
          <span class="script-preview__card-value">{{ advancedParams.maxScenes }}个/集</span>
        </div>
      </div>
    </div>
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:file-text" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">字数上限</span>
          <span class="script-preview__card-value">{{ advancedParams.maxWords }}字/集</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:message-circle" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">台词占比</span>
          <span class="script-preview__card-value">{{ advancedParams.dialogueRatio }}%</span>
        </div>
      </div>
    </div>

    <!-- 画面比例 + 画风风格 -->
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:ratio" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">画面比例</span>
          <span class="script-preview__card-value">{{ params.aspectRatio || '9:16' }}</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:palette" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">画风风格</span>
          <span class="script-preview__card-value">{{ params.artStyle || '日系动漫' }}</span>
        </div>
      </div>
    </div>

    <!-- 受众性别 -->
    <div class="script-preview__card">
      <div class="script-preview__card-icon"><Icon name="lucide:users" size="16" /></div>
      <div class="script-preview__card-info">
        <span class="script-preview__card-label">受众性别</span>
        <span class="script-preview__card-value">{{ params.gender || '未选择' }}</span>
      </div>
    </div>

    <!-- 题材类型 -->
    <div class="script-preview__card">
      <div class="script-preview__card-icon"><Icon name="lucide:book-open" size="16" /></div>
      <div class="script-preview__card-info">
        <span class="script-preview__card-label">题材类型</span>
        <span class="script-preview__card-value">
          <template v-if="genres.length">{{ genres.join('、') }}</template>
          <template v-else>未选择</template>
        </span>
      </div>
    </div>

    <!-- 预估信息 -->
    <div class="script-preview__estimate">
      <div class="script-preview__estimate-item">
        <span class="script-preview__estimate-label">预估总字数</span>
        <span class="script-preview__estimate-value">{{ estimatedWords }}万字</span>
      </div>
      <div class="script-preview__estimate-item">
        <span class="script-preview__estimate-label">预估总时长</span>
        <span class="script-preview__estimate-value">{{ estimatedDuration }}小时</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 剧本细节展示盘组件
 * 动态展示左侧参数面板的配置
 */
const props = defineProps({
  /** 参数对象 */
  params: {
    type: Object,
    default: () => ({
      episodes: 80,
      duration: 2,
      gender: '男频',
      genres: [],
    }),
  },
  /** 高级参数 */
  advancedParams: {
    type: Object,
    default: () => ({
      maxRoles: 10,
      maxScenes: 3,
      maxWords: 1200,
      dialogueRatio: 50,
    }),
  },
})

/* 题材类型 */
const genres = computed(() => props.params.genres || [])

/* 预估总字数（集数 × 每集字数上限） */
const estimatedWords = computed(() => {
  return ((props.params.episodes * props.advancedParams.maxWords) / 10000).toFixed(1)
})

/* 预估总时长 */
const estimatedDuration = computed(() => {
  return ((props.params.episodes * props.params.duration) / 60).toFixed(1)
})
</script>

<style scoped>
/* ========================================
 * 剧本细节展示盘
 * ======================================== */
.script-preview {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 24px;
  height: 100%;
}

.script-preview__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
}

.script-preview__title-icon {
  font-size: 18px;
}

.script-preview__desc {
  font-size: 12px;
  color: var(--color-text-light);
  margin-bottom: 20px;
}

/* 同行两卡片 */
.script-preview__row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.script-preview__card--half {
  flex: 1;
  min-width: 0;
}

.script-preview__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  margin-bottom: 10px;
}

.script-preview__row .script-preview__card {
  margin-bottom: 0;
}

.script-preview__card:hover {
  background: var(--color-primary-bg);
}

.script-preview__card-icon {
  font-size: 18px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-white);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.script-preview__card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.script-preview__card-label {
  font-size: 11px;
  color: var(--color-text-light);
}

.script-preview__card-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

/* 预估信息 */
.script-preview__estimate {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  margin-top: 10px;
  border-top: 1px solid var(--color-border-light);
}

.script-preview__estimate-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.06), rgba(247, 65, 143, 0.06));
  border-radius: var(--radius-sm);
}

.script-preview__estimate-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.script-preview__estimate-value {
  font-size: 16px;
  font-weight: 700;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
