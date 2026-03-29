<template>
  <div class="drama-card" @click="handleClick" @mouseenter="hovered = true" @mouseleave="hovered = false">
    <!-- 图片区域 (h-[230px]) + 渐变边框 -->
    <div class="drama-card__image-wrap" :class="{ 'drama-card__image-wrap--hover': hovered }">
      <div class="drama-card__image-box">
        <!-- 封面图 (hover放大110%) -->
        <img
          :src="cover"
          :alt="title"
          loading="lazy"
          class="drama-card__cover"
          :class="{ 'drama-card__cover--zoomed': hovered }"
        />

        <!-- 评分角标 (左上角, 仅右下圆角) -->
        <div v-if="score" class="drama-card__score" :style="{ background: gradeColor }">
          <div class="drama-card__score-bg" :style="{ background: gradeColor }"></div>
          <div class="drama-card__score-content">
            <div class="drama-card__score-text">{{ score }}/{{ grade }}</div>
            <div class="drama-card__score-label">评级</div>
          </div>
        </div>

        <!-- 已售出遮罩 (60%黑色 + 图标) -->
        <div v-if="soldOut" class="drama-card__sold-overlay">
          <span class="drama-card__sold-text">已售出</span>
        </div>

        <!-- 底部信息覆盖 (标签 + 集数) -->
        <div class="drama-card__bottom-info">
          <!-- 标签行 (暗色半透明药丸) -->
          <div v-if="displayTags.length" class="drama-card__tags-row">
            <div class="drama-card__tags-scroll">
              <span
                v-for="tag in displayTags"
                :key="tag"
                class="drama-card__tag"
              >{{ tag }}</span>
            </div>
          </div>
          <!-- 集数/字数 -->
          <div class="drama-card__episode-info">
            <span v-if="totalEpisodes">{{ createdEpisodes }}集/{{ totalEpisodes }}集</span>
            <span v-if="totalEpisodes && wordCount"> ｜</span>
            <span v-if="wordCount">{{ wordCount }}字</span>
          </div>
        </div>

        <!-- Hover底部面板 (滑入效果) -->
        <div class="drama-card__hover-panel" :class="{ 'drama-card__hover-panel--visible': hovered }">
          <div class="drama-card__hover-btn">我要试读</div>
        </div>
      </div>
    </div>

    <!-- 底部文字区域 (title + price, 约50px) -->
    <div class="drama-card__text-area">
      <!-- 标题 -->
      <div class="drama-card__title">{{ title }}</div>
      <!-- 售价行 -->
      <div class="drama-card__price-row">
        <div class="drama-card__price-label">
          <Icon name="lucide:coins" class="drama-card__coin-icon" size="14" />
          <span>售价:</span>
        </div>
        <div class="drama-card__price-value">
          <span class="drama-card__price-num">{{ price || '0' }}</span>
          <span class="drama-card__price-unit">积分</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 短剧卡片组件 - 1:1 像素级复刻创一AI风格
 * 数据来源: creatifyone.com 真实CSS/JS逆向提取
 */

const props = defineProps({
  dramaId: { type: String, required: true },
  title: { type: String, required: true },
  cover: { type: String, required: true },
  createdEpisodes: { type: Number, default: 0 }, // 已创建的剧集数
  totalEpisodes: Number, // 总集数
  wordCount: String,
  tags: { type: Array, default: () => [] },
  price: String,
  score: String,
  grade: String,
  soldOut: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const hovered = ref(false)

const displayTags = computed(() => props.tags.slice(0, 4))

/**
 * 评分等级颜色映射 - 完全复刻创一AI的 getScoreLevel 函数
 * 源码: creatifyone.com/_nuxt/D55tvXp0.js
 */
const gradeColorMap = {
  'S+': 'linear-gradient(139deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%)',
  'S': '#FD71AF',
  'A+': 'linear-gradient(139deg, #FF4472 16%, #FFAA4C 100%)',
  'A': '#7B68EE',
  'B': '#21E6C1',
  'C': '#49CCF9',
  'D': '#9896A3',
}

const gradeColor = computed(() => {
  const g = props.grade || ''
  if (g.includes('S+')) return gradeColorMap['S+']
  if (g.includes('A+')) return gradeColorMap['A+']
  if (g.includes('S')) return gradeColorMap['S']
  if (g.includes('A')) return gradeColorMap['A']
  if (g.includes('B')) return gradeColorMap['B']
  if (g.includes('C')) return gradeColorMap['C']
  if (g.includes('D')) return gradeColorMap['D']
  return '#7B68EE'
})

const handleClick = () => {
  emit('click', props.dramaId)
}
</script>

<style scoped>
/* ========================================
 * 完全复刻 creatifyone.com 卡片样式
 * 数据源: data-v-bac390e3 / Sftau4Wb.js
 * ======================================== */

/* 卡片整体 */
.drama-card {
  cursor: pointer;
  width: 100%;
  margin-top: 16px;
  transition: box-shadow 0.3s;
}

/* 图片区域包裹: 3:4宽高比, 带渐变边框 */
.drama-card__image-wrap {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 8px;
  position: relative;
}

/* 渐变边框效果 (hover时显示) */
.drama-card__image-wrap::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 10px; /* 8 + 2 */
  background: linear-gradient(90deg, #9e36ff, #ff4472 55%, #ffaa4c);
  z-index: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}

.drama-card__image-wrap--hover::before {
  opacity: 1;
  visibility: visible;
}

/* 图片容器: rounded-[8px] overflow-hidden */
.drama-card__image-box {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  z-index: 1;
  background: #f5f5f5;
}

/* 封面图: hover时 scale-110, 500ms */
.drama-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease-out;
  transform: scale(1);
}

.drama-card__cover--zoomed {
  transform: scale(1.1);
}

/* 评分角标: 左上角, 仅右下圆角 (rounded-br-[8px])
 * 尺寸: w-[38px] h-[33px] */
.drama-card__score {
  position: absolute;
  top: 0;
  left: 0;
  width: 38px;
  height: 33px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom-right-radius: 8px;
  overflow: hidden;
}

.drama-card__score-bg {
  position: absolute;
  inset: 0;
  border-bottom-right-radius: 8px;
  opacity: 0.9;
}

.drama-card__score-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 38px;
  height: 33px;
  justify-content: center;
}

.drama-card__score-text {
  color: #fff;
  font-size: 10px;
  font-weight: 400;
  height: 10px;
  line-height: 10px;
}

.drama-card__score-label {
  color: #fff;
  font-size: 9px;
  font-weight: 400;
  height: 10px;
  line-height: 10px;
  margin-top: 4px;
}

/* 已售出遮罩: 全覆盖60%黑色 */
.drama-card__sold-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.drama-card__sold-text {
  color: #fff;
  font-weight: 500;
  font-size: 14px;
  /* 使用文字代替图标 */
  border: 2px solid rgba(255, 255, 255, 0.7);
  padding: 6px 16px;
  border-radius: 4px;
  letter-spacing: 2px;
}

/* 底部信息 (标签 + 集数, 在图片内底部) */
.drama-card__bottom-info {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 20;
}

/* 标签行: h-[24px] */
.drama-card__tags-row {
  height: 24px;
  padding: 0 4px;
  margin: 0 auto;
}

.drama-card__tags-scroll {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* 标签药丸: .bgitem
 * bg: #17171799, rounded: 15px, 白字, 10px, h: 21px, px: 8px */
.drama-card__tag {
  background: rgba(23, 23, 23, 0.6); /* #17171799 */
  border-radius: 15px; /* .9375rem */
  color: #fff;
  font-size: 10px; /* .625rem */
  font-weight: 400;
  height: 21px; /* 1.3125rem */
  line-height: 21px;
  padding: 0 8px; /* 0 .5rem */
  flex-shrink: 0;
  margin: 0 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 集数/字数: 白字, 10px, 图片底部 */
.drama-card__episode-info {
  color: #fff;
  font-size: 10px;
  font-weight: 400;
  margin-top: 3px;
  margin-bottom: 5px;
  margin-left: 10px;
  line-height: 20px;
  word-break: break-all;
  overflow: hidden;
}

/* Hover底部面板: 滑入效果
 * bg-[rgba(0,0,0,0.6)] backdrop-blur-[5px]
 * 从底部滑入 (translate-y-2 → translate-y-0) */
.drama-card__hover-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 20;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.3s ease-out;
  padding: 12px 0;
  display: flex;
  justify-content: center;
}

.drama-card__hover-panel--visible {
  opacity: 1;
  transform: translateY(0);
}

/* "我要试读"按钮: 渐变背景, 圆角
 * w-[96px] h-[30px] rounded-[20px]
 * bg: linear-gradient(90deg, #9E36FF, #FF4472 55%, #FFAA4C) */
.drama-card__hover-btn {
  width: 96px;
  height: 30px;
  background: linear-gradient(90deg, #9E36FF 0%, #FF4472 55%, #FFAA4C 100%);
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

/* ========================================
 * 底部文字区域 (title + price)
 * 约50px高度
 * ======================================== */
.drama-card__text-area {
  width: 100%;
}

/* 标题: text-[14px] font-[500] text-[#0B0B0D] h-[22px] mt-1 truncate */
.drama-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #0B0B0D;
  line-height: 22px;
  height: 22px;
  margin-top: 4px;
  width: 100%;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 售价行: flex items-center justify-between */
.drama-card__price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drama-card__price-label {
  display: flex;
  align-items: center;
}

.drama-card__coin-icon {
  display: flex;
  align-items: center;
  color: #f59e0b;
}

.drama-card__price-label span {
  font-size: 12px;
  font-weight: 400;
  color: #56555C;
  margin: 0 6px;
}

.drama-card__price-value {
  display: flex;
  align-items: center;
}

/* 价格数字: text-[14px] font-[500] text-[#43455E] */
.drama-card__price-num {
  font-size: 14px;
  font-weight: 500;
  color: #43455E;
}

/* 积分文字: text-[12px] font-[400] text-[#56555C] ml-[6px] */
.drama-card__price-unit {
  font-size: 12px;
  font-weight: 400;
  color: #56555C;
  margin-left: 6px;
}
</style>
