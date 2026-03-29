<template>
  <div class="novel-params">
    <div class="novel-params__header">
      <h3 class="novel-params__title">剧本细节</h3>
      <button class="novel-params__edit-btn" @click="$emit('edit')">
        <Icon name="lucide:pencil" size="12" />
        修改
      </button>
    </div>

    <div class="novel-params__grid">
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:clapperboard" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">集数</span>
          <span class="novel-params__card-value">{{ params.episodes }}集</span>
        </div>
      </div>
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:clock" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">每集时长</span>
          <span class="novel-params__card-value">{{ params.duration }}分钟</span>
        </div>
      </div>
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:users" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">受众性别</span>
          <span class="novel-params__card-value">{{ params.gender || '未选择' }}</span>
        </div>
      </div>
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:book-open" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">题材类型</span>
          <span class="novel-params__card-value">{{ displayGenre }}</span>
        </div>
      </div>
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:palette" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">画风风格</span>
          <span class="novel-params__card-value">{{ params.artStyle || '未选择' }}</span>
        </div>
      </div>
      <div class="novel-params__card">
        <div class="novel-params__card-icon"><Icon name="lucide:ratio" size="14" /></div>
        <div class="novel-params__card-info">
          <span class="novel-params__card-label">画面比例</span>
          <span class="novel-params__card-value">{{ params.aspectRatio || '未选择' }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
const props = defineProps({
  params: {
    type: Object,
    default: () => ({
      episodes: 80,
      duration: 2,
      gender: '男频',
      genre: '',
      genres: [],
      artStyle: '日系动漫',
      aspectRatio: '9:16',
    }),
  },
})

defineEmits(['edit'])

const displayGenre = computed(() => {
  if (props.params.genre) return props.params.genre
  if (props.params.genres?.length) return props.params.genres.join('、')
  return '未选择'
})


</script>

<style scoped>
.novel-params {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 16px;
  overflow: hidden;
}

.novel-params__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border-light);
}

.novel-params__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.novel-params__edit-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-primary);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.novel-params__edit-btn:hover {
  background: var(--color-primary-bg);
}

.novel-params__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.novel-params__card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  transition: background 0.2s;
  min-width: 0;
  overflow: hidden;
}

.novel-params__card:hover {
  background: var(--color-primary-bg);
}

.novel-params__card-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-white);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.novel-params__card-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.novel-params__card-label {
  font-size: 10px;
  color: var(--color-text-light);
}

.novel-params__card-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
