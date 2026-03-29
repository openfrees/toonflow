<template>
  <div class="image-uploader">
    <!-- 已上传图片列表 -->
    <div v-if="imageList.length > 0" class="image-uploader__list">
      <div
        v-for="(img, index) in imageList"
        :key="index"
        class="image-uploader__item"
      >
        <img :src="getImageUrl(img)" :alt="`图片${index + 1}`" class="image-uploader__preview" />
        <button
          class="image-uploader__remove"
          @click="handleRemove(index)"
          title="删除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <!-- 上传进度 -->
        <div v-if="img.uploading" class="image-uploader__progress">
          <div class="image-uploader__progress-bar" :style="{ width: img.progress + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- 上传按钮（未达到最大数量时显示） -->
    <div
      v-if="imageList.length < maxCount"
      class="image-uploader__upload"
      @click="handleClickUpload"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        style="display: none"
        @change="handleFileChange"
      />
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <span class="image-uploader__text">上传图片</span>
    </div>
  </div>
</template>

<script setup>
/**
 * 图片上传组件
 * 支持多图上传、预览、删除、进度显示
 */
import { useToast } from '~/composables/useToast'

const { showToast } = useToast()

/** API基础地址（从 runtimeConfig 读取） */
const DEFAULT_API_BASE = useRuntimeConfig().public.apiBase

const props = defineProps({
  /** 已上传的图片URL数组 */
  modelValue: {
    type: Array,
    default: () => []
  },
  /** 最大上传数量 */
  maxCount: {
    type: Number,
    default: 3
  },
  /** 单张图片最大大小（MB） */
  maxSize: {
    type: Number,
    default: 2
  },
  /** 可选：覆盖默认上传接口域名 */
  apiBase: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
const currentApiBase = computed(() => props.apiBase || DEFAULT_API_BASE)

/** 文件输入框引用 */
const fileInput = ref(null)

/** 图片列表（包含上传状态） */
const imageList = ref([])

/**
 * 内部更新标志，防止 emitUpdate → modelValue变化 → watch重建imageList 的循环覆盖
 * 当内部操作（上传成功/删除）触发 emit 时置为 true，watch 中跳过本次同步
 */
let isInternalUpdate = false

/**
 * 监听外部 modelValue 变化，同步到内部 imageList
 * 仅在外部更新时同步（如父组件重置表单），内部更新时跳过
 */
watch(() => props.modelValue, (val) => {
  if (isInternalUpdate) {
    isInternalUpdate = false
    return
  }
  /* 外部更新：重建 imageList（包括空数组时清空） */
  if (val && val.length > 0) {
    imageList.value = val.map(url => ({ url, uploading: false, progress: 100 }))
  } else {
    imageList.value = []
  }
}, { immediate: true })

/**
 * 获取图片完整URL
 * @param {object} img - 图片对象
 * @returns {string} 完整URL
 */
const getImageUrl = (img) => {
  /* blob: 开头的临时预览URL直接返回 */
  if (img.url.startsWith('blob:') || img.url.startsWith('http')) {
    return img.url
  }
  return `${currentApiBase.value}${img.url}`
}

/**
 * 点击上传按钮
 */
const handleClickUpload = () => {
  fileInput.value?.click()
}

/**
 * 文件选择变化
 * @param {Event} e - 文件选择事件
 */
const handleFileChange = async (e) => {
  const files = Array.from(e.target.files || [])

  if (files.length === 0) return

  /* 检查数量限制 */
  const remainCount = props.maxCount - imageList.value.length
  if (files.length > remainCount) {
    showToast(`最多只能上传${props.maxCount}张图片，当前还可上传${remainCount}张`, 'warning')
    return
  }

  /* 逐个上传 */
  for (const file of files) {
    await uploadFile(file)
  }

  /* 清空input，允许重复选择同一文件 */
  e.target.value = ''
}

/**
 * 上传单个文件
 * @param {File} file - 文件对象
 */
const uploadFile = async (file) => {
  /* 验证文件类型 */
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    showToast('只支持jpg、png格式的图片', 'warning')
    return
  }

  /* 验证文件大小 */
  const maxBytes = props.maxSize * 1024 * 1024
  if (file.size > maxBytes) {
    showToast(`图片大小不能超过${props.maxSize}MB`, 'warning')
    return
  }

  /* 创建临时预览URL */
  const blobUrl = URL.createObjectURL(file)

  /* 添加到列表（显示上传中状态） */
  const imgObj = {
    url: blobUrl,
    uploading: true,
    progress: 0
  }
  imageList.value.push(imgObj)

  try {
    /* 构建FormData */
    const formData = new FormData()
    formData.append('file', file)

    /* 上传到服务器 */
    const res = await $fetch(`${currentApiBase.value}/api/upload/image`, {
      method: 'POST',
      body: formData,
    })

    if (res.code === 200) {
      /* 释放临时blob URL（必须在替换前保存引用） */
      URL.revokeObjectURL(blobUrl)

      /* 上传成功，更新为服务器返回的URL */
      imgObj.url = res.data.url
      imgObj.uploading = false
      imgObj.progress = 100

      /* 触发更新 */
      emitUpdate()
    } else {
      throw new Error(res.message || '上传失败')
    }

  } catch (err) {
    /* 释放临时blob URL */
    URL.revokeObjectURL(blobUrl)

    /* 上传失败，移除该项 */
    const index = imageList.value.indexOf(imgObj)
    if (index > -1) {
      imageList.value.splice(index, 1)
    }
    showToast(err.message || '上传失败，请稍后重试', 'error')
  }
}

/**
 * 删除图片
 * @param {number} index - 图片索引
 */
const handleRemove = (index) => {
  const img = imageList.value[index]
  /* 如果是blob URL，释放内存 */
  if (img && img.url.startsWith('blob:')) {
    URL.revokeObjectURL(img.url)
  }
  imageList.value.splice(index, 1)
  emitUpdate()
}

/**
 * 触发更新事件（标记为内部更新，防止watch循环覆盖）
 */
const emitUpdate = () => {
  isInternalUpdate = true
  const urls = imageList.value
    .filter(img => !img.uploading)
    .map(img => img.url)
  emit('update:modelValue', urls)
}
</script>

<style scoped>
/* ========== 图片上传组件 ========== */
.image-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ========== 已上传图片列表 ========== */
.image-uploader__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-uploader__item {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.image-uploader__preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 删除按钮 */
.image-uploader__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
}

.image-uploader__item:hover .image-uploader__remove {
  opacity: 1;
}

.image-uploader__remove:hover {
  background: rgba(0, 0, 0, 0.8);
}

/* 上传进度 */
.image-uploader__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.1);
}

.image-uploader__progress-bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

/* ========== 上传按钮 ========== */
.image-uploader__upload {
  width: 72px;
  height: 72px;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-secondary);
}

.image-uploader__upload:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.image-uploader__text {
  font-size: 11px;
  font-weight: 500;
}
</style>
