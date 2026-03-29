<template>
  <Teleport to="body">
    <!-- 参数编辑弹窗 -->
    <Transition name="modal-fade">
      <div v-if="visible" class="params-modal-overlay">
        <Transition name="modal-scale">
          <div v-if="visible" class="params-modal">
            <!-- 标题区 -->
            <div class="params-modal__header">
              <h2 class="params-modal__title">修改创作参数</h2>
            </div>

            <!-- 内容区：复用 ParamsPanel（宽模式两列布局） -->
            <div class="params-modal__body">
              <WriteParamsPanel
                ref="paramsPanelRef"
                v-model="localParams"
                :wide="true"
              />
            </div>

            <!-- 底部按钮 -->
            <div class="params-modal__footer">
              <button class="params-modal__btn params-modal__btn--cancel" @click="handleClose">取消</button>
              <button class="params-modal__btn params-modal__btn--confirm" @click="handleConfirm">确认修改</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- 核心参数变更二次确认弹窗 -->
    <Transition name="modal-fade">
      <div v-if="rewriteConfirmVisible" class="params-modal-overlay params-modal-overlay--top">
        <Transition name="modal-scale">
          <div v-if="rewriteConfirmVisible" class="params-modal params-modal--rewrite">
            <div class="params-modal__header params-modal__header--warn">
              <h2 class="params-modal__title">确认重写剧本</h2>
            </div>
            <div class="params-modal__body params-modal__body--rewrite">
              <div class="rewrite-warn">
                <Icon name="lucide:alert-triangle" class="rewrite-warn__icon" size="16" color="#f59e0b" />
                <p class="rewrite-warn__text">
                  你修改了<strong>核心参数</strong>（集数 / 受众 / 题材），这会导致整个剧本结构发生改变。
                  确认后将<strong>清空所有已有内容</strong>，重新生成整本剧本。
                </p>
              </div>
              <!-- 核心参数变更摘要 -->
              <div class="rewrite-summary">
                <div class="rewrite-summary__title">修改后的核心参数</div>
                <div class="rewrite-summary__items">
                  <div class="rewrite-summary__item" :class="{ 'rewrite-summary__item--changed': snapshotParams.episodes !== localParams.episodes }">
                    <span class="rewrite-summary__label">集数</span>
                    <span class="rewrite-summary__value">
                      <template v-if="snapshotParams.episodes !== localParams.episodes">
                        <span class="rewrite-summary__old">{{ snapshotParams.episodes }}集</span>
                        <span class="rewrite-summary__arrow">→</span>
                      </template>
                      <span class="rewrite-summary__new">{{ localParams.episodes }}集</span>
                    </span>
                  </div>
                  <div class="rewrite-summary__item" :class="{ 'rewrite-summary__item--changed': snapshotParams.gender !== localParams.gender }">
                    <span class="rewrite-summary__label">受众</span>
                    <span class="rewrite-summary__value">
                      <template v-if="snapshotParams.gender !== localParams.gender">
                        <span class="rewrite-summary__old">{{ snapshotParams.gender }}</span>
                        <span class="rewrite-summary__arrow">→</span>
                      </template>
                      <span class="rewrite-summary__new">{{ localParams.gender }}</span>
                    </span>
                  </div>
                  <div class="rewrite-summary__item" :class="{ 'rewrite-summary__item--changed': genresChanged }">
                    <span class="rewrite-summary__label">题材</span>
                    <span class="rewrite-summary__value rewrite-summary__value--wrap">
                      <template v-if="genresChanged">
                        <span class="rewrite-summary__old">{{ snapshotGenresText || '无' }}</span>
                        <span class="rewrite-summary__arrow">→</span>
                      </template>
                      <span class="rewrite-summary__new">{{ localGenresText || '无' }}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div class="rewrite-idea">
                <label class="rewrite-idea__label">剧本创意描述（可修改）</label>
                <textarea
                  v-model="rewriteUserIdea"
                  class="rewrite-idea__textarea"
                  placeholder="描述你想要的剧本故事..."
                  rows="5"
                ></textarea>
              </div>
            </div>
            <div class="params-modal__footer">
              <button class="params-modal__btn params-modal__btn--cancel" @click="rewriteConfirmVisible = false">取消</button>
              <button class="params-modal__btn params-modal__btn--danger" @click="handleRewriteConfirm">确认重写</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 创作参数编辑弹窗
 * 区分"轻量参数"和"核心参数"：
 * - 轻量参数（台词占比、字数上限、场景上限、角色上限、时长）：直接保存DB，不发起新AI对话
 * - 核心参数（集数、受众、题材）：弹出二次确认弹窗，确认后重写整本剧
 */
const props = defineProps({
  visible: Boolean,
  modelValue: {
    type: Object,
    default: () => ({}),
  },
  /** 用户原始创意描述（从剧本数据中传入） */
  userIdea: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'update:modelValue', 'light-save', 'rewrite'])

const paramsPanelRef = ref(null)

/* 弹窗内部使用的参数副本（避免直接修改外部数据） */
const localParams = ref({})

/* 打开弹窗时的原始参数快照（用于对比核心参数是否变化） */
const snapshotParams = ref({})

/* 二次确认弹窗状态 */
const rewriteConfirmVisible = ref(false)
const rewriteUserIdea = ref('')

/* 题材变更对比（用于二次确认弹窗展示） */
const genresChanged = computed(() => {
  const oldG = [...(snapshotParams.value.genres || [])].sort().join(',')
  const curG = [...(localParams.value.genres || [])].sort().join(',')
  return oldG !== curG
})
const snapshotGenresText = computed(() => (snapshotParams.value.genres || []).join('、'))
const localGenresText = computed(() => (localParams.value.genres || []).join('、'))

/* 弹窗打开时，拷贝一份外部参数作为编辑副本 + 快照 */
watch(() => props.visible, (val) => {
  if (val) {
    localParams.value = JSON.parse(JSON.stringify(props.modelValue))
    snapshotParams.value = JSON.parse(JSON.stringify(props.modelValue))
  }
})

/**
 * 判断核心参数是否发生变化
 * 核心参数：episodes（集数）、gender（受众）、genres（题材）
 */
const hasCoreParamChanged = () => {
  const old = snapshotParams.value
  const cur = localParams.value
  if (old.episodes !== cur.episodes) return true
  if (old.gender !== cur.gender) return true
  /* 题材对比：排序后比较 */
  const oldGenres = [...(old.genres || [])].sort().join(',')
  const curGenres = [...(cur.genres || [])].sort().join(',')
  if (oldGenres !== curGenres) return true
  return false
}

/* 关闭弹窗（不保存） */
const handleClose = () => {
  emit('close')
}

/* 确认修改：区分轻量参数和核心参数 */
const handleConfirm = () => {
  if (hasCoreParamChanged()) {
    /* 核心参数变化 → 弹出二次确认弹窗 */
    rewriteUserIdea.value = props.userIdea || ''
    rewriteConfirmVisible.value = true
  } else {
    /* 仅轻量参数变化 → 直接保存，不发起新AI对话 */
    emit('update:modelValue', { ...localParams.value })
    emit('light-save', { ...localParams.value })
    emit('close')
  }
}

/* 二次确认：执行重写 */
const handleRewriteConfirm = () => {
  rewriteConfirmVisible.value = false
  /* 更新参数到父组件 */
  emit('update:modelValue', { ...localParams.value })
  /* 触发重写事件，携带新参数 + user_idea + genre信息 */
  emit('rewrite', {
    params: { ...localParams.value },
    userIdea: rewriteUserIdea.value.trim(),
    genreIds: paramsPanelRef.value?.getSelectedGenreIds?.() || [],
    customGenres: paramsPanelRef.value?.getCustomGenresStr?.() || '',
  })
  emit('close')
}

/* 暴露内部 ParamsPanel 的方法（供父组件获取genre信息） */
defineExpose({
  getSelectedGenreIds: () => paramsPanelRef.value?.getSelectedGenreIds?.() || [],
  getCustomGenresStr: () => paramsPanelRef.value?.getCustomGenresStr?.() || '',
})
</script>

<style scoped>
/* 遮罩层 */
.params-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 弹窗主体 */
.params-modal {
  position: relative;
  width: 850px;
  max-height: 85vh;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

/* 标题区 */
.params-modal__header {
  padding: 16px 32px;
  background: linear-gradient(135deg, #ff6b35, #f7418f);
  color: #fff;
  position: relative;
  overflow: hidden;
}

.params-modal__header::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  filter: blur(30px);
}

.params-modal__title {
  font-size: 18px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

/* 内容区 */
.params-modal__body {
  flex: 1;
  padding: 0;
  overflow-y: auto;
}

/* 去掉 ParamsPanel 自带的边框和圆角（在弹窗内不需要） */
.params-modal__body :deep(.params-panel) {
  border: none;
  border-radius: 0;
}

/* 底部按钮 */
.params-modal__footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border-light);
}

.params-modal__btn {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.params-modal__btn--cancel {
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.params-modal__btn--cancel:hover {
  background: var(--color-bg-hover);
}

.params-modal__btn--confirm {
  background: var(--color-primary-gradient);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.params-modal__btn--confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
}

/* 动画 */
.modal-fade-enter-active { transition: opacity 0.3s ease; }
.modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal-scale-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-scale-leave-active { transition: all 0.25s ease-in; }
.modal-scale-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); }
.modal-scale-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }

/* 响应式 */
@media (max-width: 780px) {
  .params-modal {
    width: calc(100vw - 32px);
    max-height: 90vh;
  }
}

/* ========================================
 * 二次确认弹窗（核心参数重写）
 * ======================================== */

/* 二次确认遮罩层层级更高 */
.params-modal-overlay--top {
  z-index: 10000;
}

/* 重写确认弹窗尺寸 */
.params-modal--rewrite {
  width: 520px;
}

/* 警告色标题栏 */
.params-modal__header--warn {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

/* 重写确认内容区 */
.params-modal__body--rewrite {
  padding: 24px;
}

/* 警告提示 */
.rewrite-warn {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 10px;
  margin-bottom: 20px;
}

.rewrite-warn__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.rewrite-warn__text {
  font-size: 13px;
  line-height: 1.7;
  color: #92400e;
}

.rewrite-warn__text strong {
  color: #dc2626;
}

/* 核心参数变更摘要 */
.rewrite-summary {
  background: #f8fafc;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 20px;
}

.rewrite-summary__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.rewrite-summary__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rewrite-summary__item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #fff;
}

.rewrite-summary__item--changed {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.rewrite-summary__label {
  font-weight: 600;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 36px;
}

.rewrite-summary__value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--color-text);
}

.rewrite-summary__value--wrap {
  flex-wrap: wrap;
}

.rewrite-summary__old {
  color: var(--color-text-light);
  text-decoration: line-through;
}

.rewrite-summary__arrow {
  color: #ef4444;
  font-weight: 700;
  flex-shrink: 0;
}

.rewrite-summary__new {
  font-weight: 600;
  color: var(--color-text);
}

.rewrite-summary__item--changed .rewrite-summary__new {
  color: #dc2626;
}

/* 创意描述输入区 */
.rewrite-idea__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.rewrite-idea__textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.rewrite-idea__textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08);
}

/* 危险按钮（确认重写） */
.params-modal__btn--danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.params-modal__btn--danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}
</style>
