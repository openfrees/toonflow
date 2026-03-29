<template>
  <div class="params-display">
    <div class="params-display__header">
      <h3 class="params-display__title">剧本细节</h3>
      <button class="params-display__edit-btn" @click="$emit('edit')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        修改
      </button>
    </div>

    <div class="params-display__grid">
      <!-- 集数 -->
      <div class="params-display__item">
        <span class="params-display__label">集数</span>
        <span class="params-display__value">{{ params.episodes }}集</span>
      </div>
      <!-- 每集时长 -->
      <div class="params-display__item">
        <span class="params-display__label">每集时长</span>
        <span class="params-display__value">{{ params.duration }}分钟</span>
      </div>
      <!-- 角色上限 -->
      <div class="params-display__item">
        <span class="params-display__label">角色上限</span>
        <span class="params-display__value">{{ params.maxRoles || 10 }}人</span>
      </div>
      <!-- 场景上限 -->
      <div class="params-display__item">
        <span class="params-display__label">场景上限</span>
        <span class="params-display__value">{{ params.maxScenes || 3 }}个/集</span>
      </div>
      <!-- 字数上限 -->
      <div class="params-display__item">
        <span class="params-display__label">字数上限</span>
        <span class="params-display__value">{{ params.maxWords || 1200 }}字/集</span>
      </div>
      <!-- 台词占比 -->
      <div class="params-display__item">
        <span class="params-display__label">台词占比</span>
        <span class="params-display__value">{{ params.dialogueRatio || 50 }}%</span>
      </div>
      <!-- 受众性别 -->
      <div class="params-display__item">
        <span class="params-display__label">受众性别</span>
        <span class="params-display__value">{{ params.gender || '通用' }}</span>
      </div>
      <!-- 画面比例 -->
      <div class="params-display__item">
        <span class="params-display__label">画面比例</span>
        <span class="params-display__value">{{ params.aspect_ratio || params.aspectRatio || '9:16' }}</span>
      </div>
      <!-- 画风风格 -->
      <div class="params-display__item">
        <span class="params-display__label">画风风格</span>
        <span class="params-display__value">{{ params.style || params.artStyle || '日系动漫' }}</span>
      </div>
      <!-- 题材类型 -->
      <div class="params-display__item params-display__item--full">
        <span class="params-display__label">题材类型</span>
        <span v-if="params.genres?.length" class="params-display__value params-display__genres">
          <span v-for="g in params.genres" :key="g" class="params-display__genre-tag">{{ g }}</span>
        </span>
        <span v-else class="params-display__value params-display__value--empty">未选择</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 创作参数只读展示卡片
 * 以紧凑的 label-value 网格展示剧本参数
 * 点击"修改参数"按钮触发 edit 事件，由父组件打开编辑弹窗
 */
defineProps({
  params: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['edit'])
</script>

<style scoped>
/* ========================================
 * 参数只读展示卡片
 * ======================================== */
.params-display {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 20px;
}

/* 标题行：标题 + 修改按钮 */
.params-display__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.params-display__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

/* 修改按钮（右上角小按钮） */
.params-display__edit-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.params-display__edit-btn:hover {
  background: var(--color-primary-bg);
}
.params-display__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 20px;
}

.params-display__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 题材类型占满整行 */
.params-display__item--full {
  grid-column: 1 / -1;
}

.params-display__label {
  font-size: 11px;
  color: var(--color-text-light);
  font-weight: 500;
}

.params-display__value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.params-display__value--empty {
  color: var(--color-text-light);
  font-weight: 400;
  font-style: italic;
}

/* 题材标签 */
.params-display__genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.params-display__genre-tag {
  display: inline-block;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: 12px;
}
</style>
