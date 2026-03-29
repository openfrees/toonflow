<template>
  <div class="profile-page">
    <!-- 页面标题 -->
    <div class="profile-page__header">
      <h1 class="profile-page__title">个人资料</h1>
      <p class="profile-page__desc">管理你的账号信息</p>
    </div>

    <!-- 资料卡片 -->
    <div class="profile-card">
      <!-- 头像区域 -->
      <div class="profile-card__row">
        <span class="profile-card__label">头像</span>
        <div class="profile-card__value">
          <div class="profile-avatar" @click="triggerAvatarUpload">
            <img
              :src="displayAvatar"
              alt="头像"
              class="profile-avatar__img"
            />
            <div class="profile-avatar__overlay">
              <Icon name="lucide:camera" class="profile-avatar__overlay-icon" size="20" />
              <span class="profile-avatar__overlay-text">修改</span>
            </div>
            <!-- 上传中遮罩 -->
            <div v-if="avatarUploading" class="profile-avatar__loading">
              <span class="profile-avatar__spinner" />
            </div>
          </div>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="profile-avatar__input"
            @change="handleAvatarChange"
          />
        </div>
      </div>

      <!-- 分割线 -->
      <div class="profile-card__divider" />

      <!-- 用户编号 -->
      <div class="profile-card__row">
        <span class="profile-card__label">用户编号</span>
        <div class="profile-card__value">
          <span class="profile-card__text profile-card__text--muted">{{ userStore.userInfo?.userNo || '-' }}</span>
        </div>
      </div>

      <div class="profile-card__divider" />

      <!-- 用户名 -->
      <div class="profile-card__row">
        <span class="profile-card__label">用户名</span>
        <div class="profile-card__value">
          <template v-if="!editingNickname">
            <span class="profile-card__text">{{ userStore.userInfo?.nickname || '未设置' }}</span>
            <button class="profile-card__action-btn" @click="startEditNickname">修改</button>
          </template>
          <template v-else>
            <div class="profile-card__edit-group">
              <input
                ref="nicknameInputRef"
                v-model="nicknameValue"
                type="text"
                class="profile-card__edit-input"
                maxlength="20"
                placeholder="请输入用户名"
                @keyup.enter="saveNickname"
                @keyup.escape="cancelEditNickname"
              />
              <span class="profile-card__edit-count">{{ nicknameValue.length }}/20</span>
              <button
                class="profile-card__save-btn"
                :disabled="nicknameSaving"
                @click="saveNickname"
              >
                {{ nicknameSaving ? '保存中...' : '保存' }}
              </button>
              <button class="profile-card__cancel-btn" @click="cancelEditNickname">取消</button>
            </div>
          </template>
        </div>
      </div>

      <div class="profile-card__divider" />

      <!-- 手机号 -->
      <div class="profile-card__row">
        <span class="profile-card__label">手机号</span>
        <div class="profile-card__value">
          <template v-if="userStore.userInfo?.isPhoneBound">
            <span class="profile-card__text">{{ maskedPhone }}</span>
            <span class="profile-card__badge profile-card__badge--bound">已绑定</span>
          </template>
          <template v-else>
            <span class="profile-card__text profile-card__text--muted">未绑定</span>
            <button class="profile-card__action-btn">去绑定</button>
          </template>
        </div>
      </div>

      <div class="profile-card__divider" />

      <!-- 登录密码 -->
      <div class="profile-card__row">
        <span class="profile-card__label">登录密码</span>
        <div class="profile-card__value">
          <span
            class="profile-card__text"
            :class="{ 'profile-card__text--muted': !userStore.userInfo?.hasPassword }"
          >
            {{ userStore.userInfo?.hasPassword ? '已设置' : '未设置' }}
          </span>
          <button
            class="profile-card__action-btn"
            :disabled="!userStore.userInfo?.isPhoneBound"
            @click="openPasswordModal(userStore.userInfo?.hasPassword ? 'change' : 'set')"
          >
            {{ userStore.userInfo?.hasPassword ? '修改密码' : '去设置' }}
          </button>
        </div>
      </div>
    </div>

    <ProfilePasswordModal
      :visible="passwordModalVisible"
      :mode="passwordModalMode"
      :phone="userStore.userInfo?.phone || ''"
      @close="closePasswordModal"
      @success="handlePasswordSuccess"
    />
  </div>
</template>

<script setup>
/**
 * 个人资料页面
 * 路由：/user/profile
 * 渲染模式：CSR（需登录态）
 */
import { useUserStore } from '~/stores/user'

// 路由中间件：需要登录才能访问
definePageMeta({
  middleware: 'auth'
})

useSeo()

const userStore = useUserStore()
const { put, get } = useApi()
const { showToast } = useToast()

/** 默认头像 */
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'

/** 后端API基础地址（从 runtimeConfig 读取） */
const API_BASE = useRuntimeConfig().public.apiBase

/**
 * 拼接图片完整URL
 * 相对路径拼接 apiBase，完整URL直接返回
 */
const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('blob:')) return path
  return `${API_BASE}${path}`
}

/** 头像展示URL（优先预览 → 用户头像 → 默认头像） */
const displayAvatar = computed(() => {
  if (avatarPreview.value) return avatarPreview.value
  const avatar = userStore.userInfo?.avatar
  if (avatar) return getImageUrl(avatar)
  return defaultAvatar
})

/* ========== 登录态检查 ========== */
onMounted(async () => {
  /* 刷新最新用户信息 */
  await refreshUserInfo()
})

/** 从后端刷新用户信息 */
const refreshUserInfo = async () => {
  try {
    const res = await get('/api/auth/userinfo')
    if (res.code === 200 && res.data) {
      userStore.setLogin({
        token: userStore.token,
        userInfo: res.data,
      })
    }
  } catch {
    /* 静默失败，使用本地缓存数据 */
  }
}

/* ========== 头像上传 ========== */
const avatarInputRef = ref(null)
const avatarPreview = ref('')
const avatarUploading = ref(false)

/** 触发文件选择 */
const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

/** 处理头像文件选择 */
const handleAvatarChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  /* 校验文件大小（2MB） */
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片大小不能超过2MB', 'error')
    return
  }

  /* 本地预览 */
  const blobUrl = URL.createObjectURL(file)
  avatarPreview.value = blobUrl
  avatarUploading.value = true

  try {
    /* 构建 FormData 上传 */
    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('token')
    const res = await $fetch(`${API_BASE}/api/user/avatar`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (res.code === 200) {
      /* 更新 store 中的用户信息 */
      userStore.updateUserInfo({ avatar: res.data.avatar })
      showToast('头像更新成功', 'success')
    } else {
      showToast(res.message || '头像上传失败', 'error')
    }
  } catch (err) {
    showToast('头像上传失败，请稍后重试', 'error')
  } finally {
    /* 释放 blob URL，防止内存泄漏 */
    if (avatarPreview.value) {
      URL.revokeObjectURL(avatarPreview.value)
    }
    avatarPreview.value = ''
    avatarUploading.value = false
    /* 重置 input，允许重复选择同一文件 */
    if (avatarInputRef.value) {
      avatarInputRef.value.value = ''
    }
  }
}

/* ========== 用户名编辑 ========== */
const editingNickname = ref(false)
const nicknameValue = ref('')
const nicknameSaving = ref(false)
const nicknameInputRef = ref(null)

/** 进入编辑模式 */
const startEditNickname = () => {
  nicknameValue.value = userStore.userInfo?.nickname || ''
  editingNickname.value = true
  nextTick(() => {
    nicknameInputRef.value?.focus()
  })
}

/** 取消编辑 */
const cancelEditNickname = () => {
  editingNickname.value = false
  nicknameValue.value = ''
}

/** 保存用户名 */
const saveNickname = async () => {
  const nickname = nicknameValue.value.trim()
  if (!nickname) {
    showToast('用户名不能为空', 'error')
    return
  }
  if (nickname === userStore.userInfo?.nickname) {
    cancelEditNickname()
    return
  }

  nicknameSaving.value = true
  try {
    const res = await put('/api/user/profile', { nickname })
    if (res.code === 200) {
      userStore.updateUserInfo({ nickname: res.data.nickname })
      editingNickname.value = false
      showToast('用户名修改成功', 'success')
    } else {
      showToast(res.message || '修改失败', 'error')
    }
  } catch (err) {
    showToast(err.message || '修改失败，请稍后重试', 'error')
  } finally {
    nicknameSaving.value = false
  }
}

/* ========== 手机号脱敏 ========== */
const maskedPhone = computed(() => {
  const phone = userStore.userInfo?.phone
  if (!phone || phone.length < 7) return phone || ''
  return phone.slice(0, 3) + '****' + phone.slice(-4)
})

/* ========== 密码管理弹窗 ========== */
const passwordModalVisible = ref(false)
const passwordModalMode = ref('set')

const openPasswordModal = (mode) => {
  if (!userStore.userInfo?.isPhoneBound) {
    showToast('请先绑定手机号后再设置登录密码', 'warning')
    return
  }
  passwordModalMode.value = mode
  passwordModalVisible.value = true
}

const closePasswordModal = () => {
  passwordModalVisible.value = false
}

const handlePasswordSuccess = async () => {
  passwordModalVisible.value = false
  await refreshUserInfo()
}

/* ========== 组件卸载清理 ========== */
onUnmounted(() => {
  /* 释放可能残留的 blob URL */
  if (avatarPreview.value) {
    URL.revokeObjectURL(avatarPreview.value)
  }
})
</script>

<style scoped>
/* ========== 页面容器 ========== */
.profile-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 0;
}

/* ========== 页面标题 ========== */
.profile-page__header {
  margin-bottom: 24px;
}

.profile-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 4px;
}

.profile-page__desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ========== 资料卡片 ========== */
.profile-card {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  padding: 8px 0;
}

/* ========== 行布局 ========== */
.profile-card__row {
  display: flex;
  align-items: center;
  padding: 20px 28px;
  min-height: 72px;
}

.profile-card__label {
  width: 80px;
  flex-shrink: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.profile-card__value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-card__text {
  font-size: 0.9rem;
  color: var(--color-text);
}

.profile-card__text--muted {
  color: var(--color-text-light);
}

/* ========== 分割线 ========== */
.profile-card__divider {
  height: 1px;
  background: var(--color-border-light);
  margin: 0 28px;
}

/* ========== 头像 ========== */
.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 2px solid var(--color-border);
  transition: border-color 0.2s;
}

.profile-avatar:hover {
  border-color: var(--color-primary);
}

.profile-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-avatar__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.profile-avatar:hover .profile-avatar__overlay {
  opacity: 1;
}

.profile-avatar__overlay-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.profile-avatar__overlay-text {
  font-size: 0.65rem;
  color: #fff;
  font-weight: 500;
}

.profile-avatar__loading {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.profile-avatar__input {
  display: none;
}

/* ========== 操作按钮 ========== */
.profile-card__action-btn {
  padding: 4px 14px;
  font-size: 0.8rem;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.profile-card__action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-card__action-btn:hover {
  background: rgba(255, 107, 53, 0.15);
}

/* ========== 绑定状态标签 ========== */
.profile-card__badge {
  padding: 2px 10px;
  font-size: 0.75rem;
  border-radius: 10px;
  font-weight: 500;
}

.profile-card__badge--bound {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.1);
}

/* ========== 编辑组 ========== */
.profile-card__edit-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.profile-card__edit-input {
  flex: 1;
  max-width: 240px;
  padding: 6px 12px;
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
  color: var(--color-text);
  background: var(--color-bg-white);
  transition: border-color 0.2s;
}

.profile-card__edit-input:focus {
  border-color: var(--color-primary);
}

.profile-card__edit-count {
  font-size: 0.7rem;
  color: var(--color-text-light);
  white-space: nowrap;
}

.profile-card__save-btn {
  padding: 6px 16px;
  font-size: 0.8rem;
  color: #fff;
  background: var(--color-primary-gradient);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.profile-card__save-btn:hover {
  opacity: 0.9;
}

.profile-card__save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-card__cancel-btn {
  padding: 6px 14px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.profile-card__cancel-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-secondary);
}

/* ========== Toast 提示 ========== */
</style>
