<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="preview-modal-overlay" @click.self="emit('close')">
        <Transition name="modal-scale">
          <div v-if="visible" class="preview-modal">
            <!-- 顶部标题栏 -->
            <div class="preview-modal__header">
              <h2 class="preview-modal__title">{{ scriptData.title || '未命名剧本' }}</h2>
              <div class="preview-modal__header-actions">
                <button
                  class="preview-modal__download-btn"
                  type="button"
                  :disabled="downloading"
                  @click="handleDownloadScript"
                >
                  <Icon name="lucide:download" size="16" />
                  <span>{{ downloading ? '整理中...' : '下载剧本' }}</span>
                </button>
                <button class="preview-modal__close" type="button" @click="emit('close')">
                  ✕
                </button>
              </div>
            </div>
            <!-- 主体：左侧导航 + 右侧内容 -->
            <div class="preview-modal__body">
              <!-- 左侧大纲导航 -->
              <nav class="preview-modal__nav">
                <div
                  v-for="item in navItems"
                  :key="item.id"
                  class="preview-modal__nav-item"
                  :class="{
                    'preview-modal__nav-item--active': activeNav === item.id,
                    'preview-modal__nav-item--sub': item.level === 2,
                  }"
                  @click="scrollTo(item.id)"
                >
                  {{ item.label }}
                </div>
              </nav>
              <!-- 右侧内容区 -->
              <div ref="contentRef" class="preview-modal__content" @scroll="onContentScroll">
                <section id="preview-title" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:file-text" size="16" /> 剧本标题</h3>
                  <div class="preview-modal__section-body">{{ scriptData.title || '暂无' }}</div>
                </section>
                <section v-if="!isNovelPreview" id="preview-basicInfo" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:clipboard-list" size="16" /> 基本信息</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.basicInfo || '暂无' }}</div>
                </section>
                <section v-if="!isNovelPreview" id="preview-synopsis" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:book-open" size="16" /> 剧情梗概</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.synopsis || '暂无' }}</div>
                </section>
                <section v-if="!isNovelPreview" id="preview-characters" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:users" size="16" /> 人物介绍</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.characters || '暂无' }}</div>
                </section>
                <section v-if="!isNovelPreview" id="preview-emotionPoints" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:flame" size="16" /> 信息流情绪点</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.emotionPoints || '暂无' }}</div>
                </section>
                <section v-if="!isNovelPreview" id="preview-plotLines" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:link" size="16" /> 剧情线</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.plotLines || '暂无' }}</div>
                </section>
                <section v-if="isNovelPreview" id="preview-storyline" class="preview-modal__section">
                  <h3 class="preview-modal__section-title"><Icon name="lucide:git-branch" size="16" /> 故事线</h3>
                  <div class="preview-modal__section-body preview-modal__section-body--pre">{{ scriptData.storyline || '暂无' }}</div>
                </section>
                <section id="preview-episodes" class="preview-modal__section">
                  <div class="preview-modal__episode-sticky">
                    <h3 class="preview-modal__section-title"><Icon name="lucide:clapperboard" size="16" /> 剧集</h3>
                    <div class="preview-modal__episode-tabs">
                      <button
                        v-for="tab in episodeTabs"
                        :key="tab.key"
                        class="preview-modal__episode-tab"
                        :class="{ 'preview-modal__episode-tab--active': activeTab === tab.key }"
                        @click="activeTab = tab.key"
                      >
                        <Icon :name="tab.icon" size="14" /> {{ tab.label }}
                      </button>
                    </div>
                  </div>
                  <div
                    v-for="(ep, idx) in scriptData.episodes"
                    :key="idx"
                    :id="'preview-episode-' + idx"
                    class="preview-modal__episode"
                  >
                    <h4 class="preview-modal__episode-title">第{{ idx + 1 }}集：{{ ep.title || '未命名' }}</h4>
                    <div class="preview-modal__episode-body preview-modal__section-body--pre">
                      <template v-if="activeTab === 'outline'">{{ stripTitle(ep.content) || '暂无大纲' }}</template>
                      <template v-else>{{ stripTitle(ep.scriptContent) || '暂无剧本' }}</template>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <!-- 剧本导出进度遮罩 -->
            <div v-if="downloading" class="preview-modal__download-overlay">
              <div class="preview-modal__download-card">
                <div class="preview-modal__download-icon">
                  <Icon name="lucide:loader-2" size="26" />
                </div>
                <div class="preview-modal__download-title">正在整理 Word 剧本</div>
                <div class="preview-modal__download-subtitle">
                  系统正在根据当前预览内容生成文档，请稍候片刻…
                </div>
                <div class="preview-modal__progress-bar">
                  <div class="preview-modal__progress-inner" :style="{ width: `${downloadProgress}%` }"></div>
                </div>
                <div class="preview-modal__progress-text">
                  {{ downloadProgress }}%
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  scriptData: { type: Object, required: true },
  /** 剧本ID（用于导出接口调用） */
  scriptId: { type: String, default: '' },
  /** 预览来源：script=普通剧本，novel=小说转剧本 */
  previewMode: { type: String, default: 'script' },
})
const emit = defineEmits(['close'])

const contentRef = ref(null)
const activeNav = ref('preview-title')
const episodeTabs = [
  { key: 'outline', label: '大纲', icon: 'lucide:clipboard-list' },
  { key: 'script', label: '剧本', icon: 'lucide:file-text' },
]
const activeTab = ref('outline')
const isNovelPreview = computed(() => props.previewMode === 'novel')
const navItems = computed(() => {
  const items = isNovelPreview.value
    ? [
        { id: 'preview-title', label: '剧本标题', level: 1 },
        { id: 'preview-storyline', label: '故事线', level: 1 },
        { id: 'preview-episodes', label: '剧集', level: 1 },
      ]
    : [
        { id: 'preview-title', label: '剧本标题', level: 1 },
        { id: 'preview-basicInfo', label: '基本信息', level: 1 },
        { id: 'preview-synopsis', label: '剧情梗概', level: 1 },
        { id: 'preview-characters', label: '人物介绍', level: 1 },
        { id: 'preview-emotionPoints', label: '信息流情绪点', level: 1 },
        { id: 'preview-plotLines', label: '剧情线', level: 1 },
        { id: 'preview-episodes', label: '剧集', level: 1 },
      ]
  if (props.scriptData.episodes) {
    props.scriptData.episodes.forEach((ep, idx) => {
      items.push({ id: `preview-episode-${idx}`, label: `第${idx + 1}集：${ep.title || '未命名'}`, level: 2 })
    })
  }
  return items
})
const scrollTo = (id) => {
  activeNav.value = id
  const el = document.getElementById(id)
  if (el && contentRef.value) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 导出进度状态 */
const downloading = ref(false)
const downloadProgress = ref(0)
let eventSource = null

const { showToast } = useToast()
const runtimeConfig = useRuntimeConfig()

/** 点击"下载剧本" - 使用 SSE 流式接收 */
const handleDownloadScript = async () => {
  if (!props.scriptId) {
    showToast('缺少剧本ID，无法导出', 'error')
    return
  }
  if (downloading.value) return

  try {
    downloading.value = true
    downloadProgress.value = 1

    const baseURL = runtimeConfig.public.apiBase || ''
    const token = process.client ? localStorage.getItem('token') : ''

    // 通过 URL 参数传递 token
    const url = `${baseURL}/api/script/${props.scriptId}/export-word?token=${encodeURIComponent(token)}&mode=${encodeURIComponent(props.previewMode)}`
    eventSource = new EventSource(url)

    // 监听后端自定义 SSE 事件
    eventSource.addEventListener('start', (event) => {
      downloadProgress.value = 5
    })

    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data || '{}')
        downloadProgress.value = data.percent || downloadProgress.value + 5
      } catch (e) {
        console.error('解析 progress 事件失败:', e)
      }
    })

    eventSource.addEventListener('done', (event) => {
      try {
        const data = JSON.parse(event.data || '{}')
        downloadProgress.value = 100
        if (data.downloadUrl) {
          downloadFile(data.downloadUrl, token)
        }
      } catch (e) {
        console.error('解析 done 事件失败:', e)
        showToast('导出结果解析失败', 'error')
        downloading.value = false
        downloadProgress.value = 0
      }
    })

    eventSource.addEventListener('error', (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : {}
        showToast(data.message || '导出失败', 'error')
      } catch {
        showToast('导出失败', 'error')
      }
      downloading.value = false
      downloadProgress.value = 0
    })

    eventSource.addEventListener('cancelled', () => {
      showToast('已取消导出', 'warning')
      downloading.value = false
      downloadProgress.value = 0
    })

    eventSource.addEventListener('close', () => {
      eventSource?.close()
      eventSource = null
    })

    eventSource.onerror = () => {
      console.error('SSE 连接错误')
      eventSource?.close()
      if (downloadProgress.value < 100) {
        downloading.value = false
        downloadProgress.value = 0
      }
    }

  } catch (e) {
    console.error('导出剧本失败:', e)
    showToast('生成剧本 Word 失败，请稍后重试', 'error')
    downloading.value = false
    downloadProgress.value = 0
    eventSource?.close()
  }
}

// 触发文件下载
const downloadFile = async (downloadUrl, token) => {
  try {
    const baseURL = runtimeConfig.public.apiBase || ''
    const response = await fetch(`${baseURL}${downloadUrl}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    // 如果后端返回错误（如404/500），不再把错误文本当成docx下载
    if (!response.ok) {
      const msg = await response.text().catch(() => '')
      console.error('下载接口返回错误：', response.status, msg)
      showToast(msg || '文件下载失败，请稍后重试', 'error')
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const title = props.scriptData.title || '未命名剧本'
    a.href = url
    a.download = `剧本《${title}》.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('剧本 Word 文档已开始下载', 'success')
  } catch (e) {
    console.error('下载文件失败:', e)
    showToast('文件下载失败', 'error')
  } finally {
    downloading.value = false
    downloadProgress.value = 0
    eventSource?.close()
  }
}

// 页面卸载时清理连接
onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
})

/* 去掉内容第一行的标题（如"第1集：xxx"或"第一集：xxx"），避免和episode-title重复 */
const stripTitle = (text) => {
  if (!text) return ''
  const lines = text.split('\n')
  if (/^第[0-9一二三四五六七八九十百千]+集/.test(lines[0].trim())) {
    return lines.slice(1).join('\n').trim()
  }
  return text.trim()
}
const onContentScroll = () => {
  if (!contentRef.value) return
  const sections = contentRef.value.querySelectorAll('[id^="preview-"]')
  const containerTop = contentRef.value.getBoundingClientRect().top
  /* 找到最后一个顶部已经滚过容器顶部（或刚好在顶部）的section */
  let current = null
  sections.forEach((sec) => {
    if (sec.getBoundingClientRect().top <= containerTop + 10) {
      current = sec.id
    }
  })
  /* 如果没有任何section滚过顶部（说明在最顶部），取第一个 */
  if (!current && sections.length) current = sections[0].id
  if (current) activeNav.value = current
}
</script>

<style scoped>
.preview-modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
}
.preview-modal {
  width: 90vw; height: 80vh; background: #fff; border-radius: 12px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.preview-modal__header {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 1px solid var(--color-border-light);
}
.preview-modal__title { font-size: 16px; font-weight: 600; color: var(--color-text); margin: 0; }
.preview-modal__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.preview-modal__download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-primary);
  background: rgba(99, 102, 241, 0.06);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s;
}
.preview-modal__download-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
  transform: translateY(-1px);
}
.preview-modal__download-btn:disabled {
  opacity: 0.7;
  cursor: default;
  box-shadow: none;
}
.preview-modal__close {
  width: 32px; height: 32px; border: none; background: none;
  font-size: 16px; color: var(--color-text-light); cursor: pointer; border-radius: 6px; transition: background 0.2s;
}
.preview-modal__close:hover { background: var(--color-bg-hover); }
.preview-modal__body { flex: 1; min-height: 0; display: flex; }
.preview-modal__nav {
  width: 220px; flex-shrink: 0; border-right: 1px solid var(--color-border-light);
  overflow-y: auto; padding: 12px 0; background: var(--color-bg);
}
.preview-modal__nav::-webkit-scrollbar { display: none; }
.preview-modal__nav-item {
  padding: 8px 16px; font-size: 13px; color: var(--color-text-secondary);
  cursor: pointer; transition: background 0.15s, color 0.15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.preview-modal__nav-item--sub { padding-left: 32px; font-size: 12px; }
.preview-modal__nav-item:hover { background: var(--color-bg-hover); }
.preview-modal__nav-item--active {
  color: var(--color-primary); background: rgba(99, 102, 241, 0.08); font-weight: 500;
}
.preview-modal__content { flex: 1; min-width: 0; overflow-y: auto; padding: 24px 32px; }
.preview-modal__content::-webkit-scrollbar { width: 6px; }
.preview-modal__content::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
.preview-modal__section { margin-bottom: 24px; }
.preview-modal__section-title {
  font-size: 16px; font-weight: 600; color: var(--color-text);
  margin: 0 0 12px; padding-top: 8px;padding-bottom: 8px; border-bottom: 1px solid var(--color-border-light);
}
.preview-modal__section-body { font-size: 14px; color: var(--color-text-secondary); line-height: 1.8; }
.preview-modal__section-body--pre { white-space: pre-wrap; word-break: break-word; }
.preview-modal__episode-sticky {
  position: sticky; top: -24px; z-index: 10; background: #fff; padding-bottom: 4px;
}
.preview-modal__episode-tabs {
  display: flex; gap: 4px; margin-bottom: 16px; background: var(--color-bg); border-radius: 8px; padding: 4px;
}
.preview-modal__episode-tab {
  padding: 6px 16px; border: none; background: none; font-size: 13px;
  color: var(--color-text-secondary); cursor: pointer; border-radius: 6px; transition: background 0.2s, color 0.2s;
}
.preview-modal__episode-tab:hover { background: var(--color-bg-hover); }
.preview-modal__episode-tab--active {
  background: #fff; color: var(--color-primary); font-weight: 500; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.preview-modal__episode { margin-bottom: 20px; padding: 16px; background: var(--color-bg); border-radius: 8px; border: 1px solid var(--color-border-light); }
.preview-modal__episode-title { font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0 0 8px; }
.preview-modal__episode-body { font-size: 13px; color: var(--color-text-secondary); line-height: 1.8; }
.preview-modal__download-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  backdrop-filter: blur(6px);
}
.preview-modal__download-card {
  width: 360px;
  max-width: 90%;
  background: #fff;
  border-radius: 16px;
  padding: 24px 24px 20px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
  text-align: center;
}
.preview-modal__download-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 12px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  animation: preview-spinner 1s linear infinite;
}
.preview-modal__download-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}
.preview-modal__download-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}
.preview-modal__progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--color-bg);
  overflow: hidden;
  margin-bottom: 8px;
}
.preview-modal__progress-inner {
  position: absolute;
  inset: 0;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f46e5, #6366f1, #a855f7);
  transition: width 0.25s ease-out;
}
.preview-modal__progress-text {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 500;
}
@keyframes preview-spinner {
 0% { transform: rotate(0deg); }
 100% { transform: rotate(360deg); }
}
.modal-fade-enter-active { transition: opacity 0.3s ease; }
.modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-scale-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-scale-leave-active { transition: all 0.25s ease-in; }
.modal-scale-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); }
.modal-scale-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }
</style>
