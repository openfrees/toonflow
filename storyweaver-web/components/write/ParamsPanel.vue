<template>
  <div class="params-panel" :class="{ 'params-panel--wide': wide }">
    <!-- 面板内容 -->
    <div class="params-panel__body">
      <h3 v-if="!wide" class="params-panel__title">创作参数</h3>

      <!-- wide模式：两列布局 -->
      <div v-if="wide" class="params-panel__grid">
        <!-- 左列：滑块类参数 -->
        <div class="params-panel__grid-col">
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
          <!-- 每集时长 -->
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
          <!-- 主要角色上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>主要角色上限</span>
              <span class="params-panel__value">{{ params.maxRoles }}人</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">5人</span>
              <input type="range" class="params-panel__slider" :min="5" :max="15" :step="1" :value="params.maxRoles" @input="updateParam('maxRoles', +$event.target.value)" />
              <span class="params-panel__range-label">15人</span>
            </div>
          </div>
          <!-- 每集场景上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>每集场景上限</span>
              <span class="params-panel__value">{{ params.maxScenes }}个</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">1个</span>
              <input type="range" class="params-panel__slider" :min="1" :max="5" :step="1" :value="params.maxScenes" @input="updateParam('maxScenes', +$event.target.value)" />
              <span class="params-panel__range-label">5个</span>
            </div>
          </div>
          <!-- 每集字数上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>每集字数上限</span>
              <span class="params-panel__value">{{ params.maxWords }}字</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">600字</span>
              <input type="range" class="params-panel__slider" :min="600" :max="2000" :step="200" :value="params.maxWords" @input="updateParam('maxWords', +$event.target.value)" />
              <span class="params-panel__range-label">2000字</span>
            </div>
          </div>
          <!-- 台词字数占比 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>台词字数占比</span>
              <span class="params-panel__value">{{ params.dialogueRatio }}%</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">30%</span>
              <input type="range" class="params-panel__slider" :min="30" :max="60" :step="10" :value="params.dialogueRatio" @input="updateParam('dialogueRatio', +$event.target.value)" />
              <span class="params-panel__range-label">60%</span>
            </div>
          </div>
        </div>

        <!-- 右列：受众性别 + 画面比例 + 画风风格 + 题材类型 -->
        <div class="params-panel__grid-col">
          <!-- 受众性别 -->
          <div class="params-panel__group">
            <div class="params-panel__label"><span>受众性别</span></div>
            <div class="params-panel__tags">
              <button v-for="item in genderOptions" :key="item" class="params-panel__tag params-panel__tag--lg" :class="{ 'params-panel__tag--active': params.gender === item }" @click="updateParam('gender', item)">{{ item }}</button>
            </div>
          </div>
          <!-- 画风风格 -->
          <div class="params-panel__group">
            <div class="params-panel__label"><span>画风风格</span></div>
            <div class="params-panel__tags">
              <button v-for="item in artStyleOptions" :key="item.value" class="params-panel__tag params-panel__tag--sm" :class="{ 'params-panel__tag--active': params.artStyle === item.value }" @click="updateParam('artStyle', item.value)">{{ item.label }}</button>
            </div>
          </div>
          <!-- 画面比例 -->
          <div class="params-panel__group">
            <div class="params-panel__label"><span>画面比例</span></div>
            <div class="params-panel__tags">
              <button v-for="item in aspectRatioOptions" :key="item.value" class="params-panel__tag params-panel__tag--sm" :class="{ 'params-panel__tag--active': params.aspectRatio === item.value }" @click="updateParam('aspectRatio', item.value)">{{ item.label }}</button>
            </div>
          </div>
          <!-- 题材类型 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>题材类型</span>
              <span class="params-panel__value">{{ selectedGenreCount }}/5</span>
            </div>
            <template v-if="genreMap['时代背景']?.length">
              <div class="params-panel__sub-label">时代背景</div>
              <div class="params-panel__tags">
                <button v-for="item in genreMap['时代背景']" :key="item" class="params-panel__tag params-panel__tag--sm" :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }" :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5" @click="toggleGenre(item)">{{ item }}</button>
              </div>
            </template>
            <template v-if="genreMap['主题情节']?.length">
              <div class="params-panel__sub-label">主题情节</div>
              <div class="params-panel__tags">
                <button v-for="item in genreMap['主题情节']" :key="item" class="params-panel__tag params-panel__tag--sm" :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }" :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5" @click="toggleGenre(item)">{{ item }}</button>
              </div>
            </template>
            <template v-if="genreMap['角色设定']?.length">
              <div class="params-panel__sub-label">角色设定</div>
              <div class="params-panel__tags">
                <button v-for="item in genreMap['角色设定']" :key="item" class="params-panel__tag params-panel__tag--sm" :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }" :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5" @click="toggleGenre(item)">{{ item }}</button>
                <button v-for="item in customGenres" :key="'custom-' + item" class="params-panel__tag params-panel__tag--sm params-panel__tag--custom" :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }" :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5" @click="toggleGenre(item)">{{ item }}</button>
              </div>
            </template>
            <div class="params-panel__custom-input">
              <input v-model.trim="customInput" class="params-panel__custom-field" placeholder="自定义题材，回车添加" maxlength="10" @keydown.enter.prevent="addCustomGenre" />
              <button class="params-panel__custom-btn" :disabled="!customInput || selectedGenreCount >= 5" @click="addCustomGenre">+</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 默认单列布局（/write页面使用） -->
      <template v-if="!wide">
        <!-- 集数滑块 -->
        <div class="params-panel__group">
          <div class="params-panel__label">
            <span>集数</span>
            <span class="params-panel__value">{{ params.episodes }}集</span>
          </div>
          <div class="params-panel__slider-row">
            <span class="params-panel__range-label">10集</span>
            <input
              type="range"
              class="params-panel__slider"
              :min="10"
              :max="120"
              :step="5"
              :value="params.episodes"
              @input="updateParam('episodes', +$event.target.value)"
            />
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
            <input
              type="range"
              class="params-panel__slider"
              :min="1"
              :max="5"
              :step="0.5"
              :value="params.duration"
              @input="updateParam('duration', +$event.target.value)"
            />
            <span class="params-panel__range-label">5分钟</span>
          </div>
        </div>

        <!-- 高级参数（滑动展开） -->
        <div class="params-panel__advanced" :class="{ 'params-panel__advanced--open': advancedOpen }">
          <!-- 主要角色上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>主要角色上限</span>
              <span class="params-panel__value">{{ params.maxRoles }}人</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">5人</span>
              <input
                type="range"
                class="params-panel__slider"
                :min="5"
                :max="15"
                :step="1"
                :value="params.maxRoles"
                @input="updateParam('maxRoles', +$event.target.value)"
              />
              <span class="params-panel__range-label">15人</span>
            </div>
          </div>

          <!-- 每集场景上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>每集场景上限</span>
              <span class="params-panel__value">{{ params.maxScenes }}个</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">1个</span>
              <input
                type="range"
                class="params-panel__slider"
                :min="1"
                :max="5"
                :step="1"
                :value="params.maxScenes"
                @input="updateParam('maxScenes', +$event.target.value)"
              />
              <span class="params-panel__range-label">5个</span>
            </div>
          </div>

          <!-- 每集字数上限 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>每集字数上限</span>
              <span class="params-panel__value">{{ params.maxWords }}字</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">600字</span>
              <input
                type="range"
                class="params-panel__slider"
                :min="600"
                :max="2000"
                :step="200"
                :value="params.maxWords"
                @input="updateParam('maxWords', +$event.target.value)"
              />
              <span class="params-panel__range-label">2000字</span>
            </div>
          </div>

          <!-- 台词字数占比 -->
          <div class="params-panel__group">
            <div class="params-panel__label">
              <span>台词字数占比</span>
              <span class="params-panel__value">{{ params.dialogueRatio }}%</span>
            </div>
            <div class="params-panel__slider-row">
              <span class="params-panel__range-label">30%</span>
              <input
                type="range"
                class="params-panel__slider"
                :min="30"
                :max="60"
                :step="10"
                :value="params.dialogueRatio"
                @input="updateParam('dialogueRatio', +$event.target.value)"
              />
              <span class="params-panel__range-label">60%</span>
            </div>
          </div>
        </div>

        <!-- 高级参数展开/收起按钮（始终在折叠区下方） -->
        <button class="params-panel__expand" @click="advancedOpen = !advancedOpen">
          <span>{{ advancedOpen ? '收起' : '高级参数' }}</span>
          <span class="params-panel__expand-arrow" :class="{ 'params-panel__expand-arrow--open': advancedOpen }">▼</span>
        </button>

        <!-- ====== 内容设定组 ====== -->

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

        <!-- 题材类型（时代背景 + 主题情节 + 角色设定，合计最多选5个） -->
        <div class="params-panel__group">
          <div class="params-panel__label">
            <span>题材类型</span>
            <span class="params-panel__value">{{ selectedGenreCount }}/5</span>
          </div>

          <!-- 时代背景 -->
          <template v-if="genreMap['时代背景']?.length">
            <div class="params-panel__sub-label">时代背景</div>
            <div class="params-panel__tags">
              <button
                v-for="item in genreMap['时代背景']"
                :key="item"
                class="params-panel__tag params-panel__tag--sm"
                :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }"
                :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5"
                @click="toggleGenre(item)"
              >{{ item }}</button>
            </div>
          </template>

          <!-- 主题情节 -->
          <template v-if="genreMap['主题情节']?.length">
            <div class="params-panel__sub-label">主题情节</div>
            <div class="params-panel__tags">
              <button
                v-for="item in genreMap['主题情节']"
                :key="item"
                class="params-panel__tag params-panel__tag--sm"
                :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }"
                :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5"
                @click="toggleGenre(item)"
              >{{ item }}</button>
            </div>
          </template>

          <!-- 角色设定 -->
          <template v-if="genreMap['角色设定']?.length">
            <div class="params-panel__sub-label">角色设定</div>
            <div class="params-panel__tags">
              <button
                v-for="item in genreMap['角色设定']"
                :key="item"
                class="params-panel__tag params-panel__tag--sm"
                :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }"
                :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5"
                @click="toggleGenre(item)"
              >{{ item }}</button>
              <!-- 用户自定义标签（追加在角色设定末尾） -->
              <button
                v-for="item in customGenres"
                :key="'custom-' + item"
                class="params-panel__tag params-panel__tag--sm params-panel__tag--custom"
                :class="{ 'params-panel__tag--active': selectedGenres.includes(item) }"
                :disabled="!selectedGenres.includes(item) && selectedGenreCount >= 5"
                @click="toggleGenre(item)"
              >{{ item }}</button>
            </div>
          </template>

          <!-- 自定义题材输入 -->
          <div class="params-panel__custom-input">
            <input
              v-model.trim="customInput"
              class="params-panel__custom-field"
              placeholder="自定义题材，回车添加"
              maxlength="10"
              @keydown.enter.prevent="addCustomGenre"
            />
            <button
              class="params-panel__custom-btn"
              :disabled="!customInput || selectedGenreCount >= 5"
              @click="addCustomGenre"
            >+</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * 参数调节面板组件
 * 支持收缩/展开，包含滑块和标签选择器
 * 两个页面复用：初始化页 + 写作页
 */
import { useStyleConfig } from '~/composables/useStyleConfig'

const { artStyleOptions, aspectRatioOptions } = useStyleConfig()

const props = defineProps({
  /** 参数对象（双向绑定） */
  modelValue: {
    type: Object,
    default: () => ({
      episodes: 80,
      duration: 2,
      gender: '男频',
      aspectRatio: '9:16',
      artStyle: '日系动漫',
      maxRoles: 10,
      maxScenes: 3,
      maxWords: 1200,
      dialogueRatio: 50,
      genres: [],
    }),
  },
  /** 宽模式：两列布局，高级参数默认展开，用于弹窗场景 */
  wide: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

/* 参数响应式代理 */
const params = computed(() => props.modelValue)

/* 高级参数折叠状态 */
const advancedOpen = ref(false)

/* 更新单个参数 */
const updateParam = (key, value) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

/* 选项数据 */
const genderOptions = ['男频', '女频', '通用']

/* 题材类型 - 从接口动态获取（保留id用于提交） */
const { get } = useApi()
const genreRawMap = ref({})
const genreMap = ref({})

onMounted(async () => {
  try {
    const res = await get('/api/genre/list')
    if (res.code === 200 && res.data) {
      /* res.data 格式: { '时代背景': [{id, name}], ... } */
      genreRawMap.value = res.data
      const mapped = {}
      const allPresets = new Set()
      for (const [category, items] of Object.entries(res.data)) {
        mapped[category] = items.map(g => g.name)
        items.forEach(g => allPresets.add(g.name))
      }
      genreMap.value = mapped

      /* 从已选题材中恢复自定义词条（不在预设列表中的即为用户自定义） */
      const currentGenres = params.value.genres || []
      const restored = currentGenres.filter(g => !allPresets.has(g))
      if (restored.length) {
        customGenres.value = restored
      }
    }
  } catch (e) {
    console.error('获取题材列表失败', e)
  }
})

/* 所有系统预设题材名称（用于自定义去重） */
const allPresetOptions = computed(() => {
  const all = []
  for (const names of Object.values(genreMap.value)) {
    all.push(...names)
  }
  return [...new Set(all)]
})

/* 题材类型多选（三个子分类共享5个名额） */
const selectedGenres = computed(() => params.value.genres || [])
const selectedGenreCount = computed(() => selectedGenres.value.length)
const toggleGenre = (item) => {
  const current = [...selectedGenres.value]
  const idx = current.indexOf(item)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else if (current.length < 5) {
    current.push(item)
  }
  updateParam('genres', current)
}

/* 自定义题材 */
const customInput = ref('')
const customGenres = ref([])
const addCustomGenre = () => {
  const val = customInput.value
  if (!val) return
  /* 已存在于预设或自定义列表中则跳过 */
  if (allPresetOptions.value.includes(val) || customGenres.value.includes(val)) {
    customInput.value = ''
    return
  }
  if (selectedGenreCount.value >= 5) return
  customGenres.value.push(val)
  /* 自动选中 */
  const current = [...selectedGenres.value, val]
  updateParam('genres', current)
  customInput.value = ''
}

/* 根据选中的题材名称，查找对应的genre ID列表（仅系统预设的） */
const getSelectedGenreIds = () => {
  const ids = []
  for (const items of Object.values(genreRawMap.value)) {
    for (const g of items) {
      if (selectedGenres.value.includes(g.name)) {
        ids.push(g.id)
      }
    }
  }
  return ids
}

/* 获取用户自定义题材（/分隔的字符串） */
const getCustomGenresStr = () => {
  return customGenres.value.filter(g => selectedGenres.value.includes(g)).join('/')
}

/* 暴露给父组件 */
defineExpose({
  getSelectedGenreIds,
  getCustomGenresStr,
})
</script>

<style scoped>
/* ========================================
 * 参数调节面板
 * ======================================== */
.params-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100%;
}

/* 面板标题 */
.params-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

/* 参数组 */
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

/* 滑块 */
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

/* 滑块行：标签 + 滑块 同行排列 */
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

/* 标签选择器 */
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

/* 小号标签（主题情节、角色设定等选项多的组） */
.params-panel__tag--sm {
  padding: 4px 10px;
  font-size: 11px;
}

/* 大号标签（受众性别） */
.params-panel__tag--lg {
  padding: 8px 24px;
  font-size: 13px;
  font-weight: 600;
}

/* 禁用态（已选满5个时未选中的标签） */
.params-panel__tag:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 子分类标题 */
.params-panel__sub-label {
  font-size: 11px;
  color: var(--color-text-light);
  margin: 10px 0 6px;
}

/* 高级参数展开按钮 */
.params-panel__expand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 6px 0;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--color-text-light);
  background: none;
  border: none;
  border-top: 1px dashed var(--color-border-light);
  cursor: pointer;
  transition: color 0.2s;
}

.params-panel__expand:hover {
  color: var(--color-primary);
}

.params-panel__expand-arrow {
  font-size: 10px;
  transition: transform 0.25s;
}

.params-panel__expand-arrow--open {
  transform: rotate(180deg);
}

/* 高级参数容器（滑动展开） */
.params-panel__advanced {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.params-panel__advanced--open {
  max-height: 400px;
}

/* 自定义题材输入 */
.params-panel__custom-input {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.params-panel__custom-field {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  outline: none;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.params-panel__custom-field:focus {
  border-color: var(--color-primary);
}

.params-panel__custom-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.params-panel__custom-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.params-panel__custom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 自定义标签带虚线边框区分 */
.params-panel__tag--custom {
  border-style: dashed;
  border-color: var(--color-border);
}

.params-panel__tag--custom.params-panel__tag--active {
  border-style: solid;
}

/* ========================================
 * 宽模式（弹窗内两列布局）
 * ======================================== */
.params-panel--wide {
  border: none;
  border-radius: 0;
}

.params-panel__grid {
  display: grid;
  grid-template-columns: 2fr 5fr;
  gap: 0 32px;
}

.params-panel__grid-col {
  min-width: 0;
}
</style>
