<template>
  <!-- 大图预览弹窗 -->
  <Teleport to="body">
    <Transition name="preview-fade">
      <div v-if="show" class="image-preview-overlay" @click.self="handleClose">
        <div class="image-preview-container">
          <!-- 关闭按钮 -->
          <button class="image-preview-close" @click="handleClose" title="关闭">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <!-- 图片 -->
          <img :src="imageUrl" :alt="imageAlt" class="image-preview-img" />
          <!-- 底部操作栏 -->
          <div class="image-preview-actions">
            <button class="image-preview-download" @click="handleDownload">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              下载原图
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 通用图片预览组件
 * 支持点击放大、ESC关闭、下载原图
 */

const props = defineProps({
  /** 是否显示预览 */
  show: { type: Boolean, default: false },
  /** 图片URL */
  imageUrl: { type: String, default: '' },
  /** 图片alt文本 */
  imageAlt: { type: String, default: '预览图片' },
  /** 下载文件名（不含扩展名） */
  downloadName: { type: String, default: '图片' },
})

const emit = defineEmits(['close'])

/** 关闭预览 */
const handleClose = () => {
  emit('close')
}

/** ESC关闭预览 */
const onKeydown = (e) => {
  if (e.key === 'Escape' && props.show) handleClose()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

/** 下载原图 */
const handleDownload = async () => {
  if (!props.imageUrl) return
  try {
    const response = await fetch(props.imageUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.downloadName}.${blob.type.split('/')[1] || 'png'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('下载失败:', err)
    // 降级：新标签页打开
    window.open(props.imageUrl, '_blank')
  }
}
</script>

<style>
/* 大图预览样式（Teleport到body，不能用scoped） */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  cursor: default;
}

.image-preview-img {
  max-width: 90vw;
  max-height: 78vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  user-select: none;
  -webkit-user-drag: none;
}

.image-preview-close {
  position: absolute;
  top: -40px;
  right: -4px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.image-preview-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.image-preview-actions {
  display: flex;
  gap: 12px;
}

.image-preview-download {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.image-preview-download:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

/* 预览弹窗过渡动画 */
.preview-fade-enter-active {
  transition: all 0.3s ease-out;
}

.preview-fade-leave-active {
  transition: all 0.2s ease-in;
}

.preview-fade-enter-from {
  opacity: 0;
}

.preview-fade-leave-to {
  opacity: 0;
}

.preview-fade-enter-from .image-preview-container {
  transform: scale(0.85);
}

.preview-fade-enter-active .image-preview-container {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.preview-fade-leave-to .image-preview-container {
  transform: scale(0.9);
}
</style>
