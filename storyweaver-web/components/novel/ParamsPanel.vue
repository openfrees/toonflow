<template>
  <div class="params-panel">
    <div class="params-panel__body">
      <h3 class="params-panel__title">创作参数</h3>

      <!-- 集数滑块 -->
      <div class="params-panel__group">
        <div class="params-panel__label">
          <span>集数</span>
          <span class="params-panel__value">{{ params.episodes }}集</span>
        </div>
        <div class="params-panel__slider-row">
          <span class="params-panel__range-label">10集</span>
          <input type="range" class="params-panel__slider" :min="10" :max="120" :step="5" :value="params.episodes" @input="updateParam('episodes', +$event.target.value)" />
          <span class="params-panel__range-label">120集</span>
        </div>
      </div>

      <!-- 每集时长滑块 -->
      <div class="params-panel__group">
        <div class="params-panel__label">
          <span>每集时长</span>
          <span class="params-panel__value">{{ params.duration }}分钟</span>
        </div>
        <div class="params-panel__slider-row">
          <span class="params-panel__range-label">1分钟</span>
          <input type="range" class="params-panel__slider" :min="1" :max="5" :step="0.5" :value="params.duration" @input="updateParam('duration', +$event.target.value)" />
          <span class="params-panel__range-label">5分钟</span>
        </div>
      </div>

      <!-- 受众性别 -->
      <div class="params-panel__group">
        <div class="params-panel__label"><span>受众性别</span></div>
        <div class="params-panel__tags">
          <button
            v-for="item in genderOptions"
            :key="item"
            class="params-panel__tag params-panel__tag--lg"
            :class="{ 'params-panel__tag--active': params.gender === item }"
            @click="updateParam('gender', item)"
          >{{ item }}</button>
        </div>
      </div>

      <!-- 题材类型（简单输入框） -->
      <div class="params-panel__group">
        <div class="params-panel__label"><span>题材类型</span></div>
        <input
          class="params-panel__input"
          :value="params.genre"
          placeholder="如：玄幻、都市、悬疑…"
          maxlength="20"
          @input="updateParam('genre', $event.target.value)"
        />
      </div>

      <!-- 画风风格 -->
      <div class="params-panel__group">
        <div class="params-panel__label"><span>画风风格</span></div>
        <div class="params-panel__tags">
          <button
            v-for="item in artStyleOptions"
            :key="item.value"
            class="params-panel__tag params-panel__tag--sm"
            :class="{ 'params-panel__tag--active': params.artStyle === item.value }"
            @click="updateParam('artStyle', item.value)"
          >{{ item.label }}</button>
        </div>
      </div>

      <!-- 画面比例 -->
      <div class="params-panel__group">
        <div class="params-panel__label"><span>画面比例</span></div>
        <div class="params-panel__tags">
          <button
            v-for="item in aspectRatioOptions"
            :key="item.value"
            class="params-panel__tag params-panel__tag--sm"
            :class="{ 'params-panel__tag--active': params.aspectRatio === item.value }"
            @click="updateParam('aspectRatio', item.value)"
          >{{ item.label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 小说转剧本 - 参数调节面板
 * 集数、时长、性别、题材（输入框）、画风、比例
 */
import { useStyleConfig } from '~/composables/useStyleConfig'

const { artStyleOptions, aspectRatioOptions } = useStyleConfig()

const props = defineProps({
  modelValue: {
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

const emit = defineEmits(['update:modelValue'])

const params = computed(() => props.modelValue)

const updateParam = (key, value) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const genderOptions = ['男频', '女频', '通用']
</script>

<style scoped>
.params-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100%;
}

.params-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.params-panel__group {
  margin-bottom: 20px;
}

.params-panel__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.params-panel__value {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
}

.params-panel__slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-border-light);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.params-panel__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
  cursor: pointer;
  transition: transform 0.15s;
}

.params-panel__slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.params-panel__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.params-panel__slider-row .params-panel__slider {
  flex: 1;
  min-width: 0;
}

.params-panel__range-label {
  font-size: 11px;
  color: var(--color-text-light);
  white-space: nowrap;
  flex-shrink: 0;
}

.params-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.params-panel__tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.params-panel__tag:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-color: rgba(255, 107, 53, 0.2);
}

.params-panel__tag--active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.params-panel__tag--active:hover {
  background: var(--color-primary-light);
  color: #fff;
  border-color: var(--color-primary-light);
}

.params-panel__tag--sm {
  padding: 4px 10px;
  font-size: 11px;
}

.params-panel__tag--lg {
  padding: 8px 24px;
  font-size: 13px;
  font-weight: 600;
}

.params-panel__input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  outline: none;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.params-panel__input:focus {
  border-color: var(--color-primary);
}

.params-panel__input::placeholder {
  color: var(--color-text-light);
}
</style>
