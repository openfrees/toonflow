<template>
  <div class="script-preview">
    <h3 class="script-preview__title">
      <Icon name="lucide:clipboard-list" class="script-preview__title-icon" size="16" style="vertical-align: middle;" />
      剧本细节
    </h3>
    <p class="script-preview__desc">根据你的参数设置，AI将按以下规格转换剧本</p>

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

    <!-- 受众性别 + 题材类型（同行） -->
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:users" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">受众性别</span>
          <span class="script-preview__card-value">{{ params.gender || '未选择' }}</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:book-open" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">题材类型</span>
          <span class="script-preview__card-value">{{ params.genre || '未填写' }}</span>
        </div>
      </div>
    </div>

    <!-- 画风风格 + 画面比例（同行） -->
    <div class="script-preview__row">
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:palette" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">画风风格</span>
          <span class="script-preview__card-value">{{ params.artStyle || '未选择' }}</span>
        </div>
      </div>
      <div class="script-preview__card script-preview__card--half">
        <div class="script-preview__card-icon"><Icon name="lucide:ratio" size="16" /></div>
        <div class="script-preview__card-info">
          <span class="script-preview__card-label">画面比例</span>
          <span class="script-preview__card-value">{{ params.aspectRatio || '未选择' }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
/**
 * 小说转剧本 - 剧本细节展示盘
 */
const props = defineProps({
  params: {
    type: Object,
    default: () => ({
      episodes: 80,
      duration: 2,
      gender: '男频',
      genre: '',
      artStyle: '日系动漫',
      aspectRatio: '9:16',
    }),
  },
})


</script>

<style scoped>
.script-preview {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 24px;
  /* height: 100%; */
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

</style>
