<template>
  <Teleport to="body">
    <Transition name="password-modal-fade">
      <div v-if="visible" class="password-modal__overlay" @click.self="handleClose">
        <Transition name="password-modal-scale">
          <div v-if="visible" class="password-modal">
            <button class="password-modal__close" type="button" @click="handleClose">
              <Icon name="lucide:x" size="18" />
            </button>

            <div class="password-modal__header">
              <div class="password-modal__icon">
                <Icon :name="isSetMode ? 'lucide:shield-plus' : 'lucide:key-round'" size="28" />
              </div>
              <h3 class="password-modal__title">{{ modalTitle }}</h3>
              <p class="password-modal__desc">{{ modalDesc }}</p>
            </div>

            <div class="password-modal__form">
              <div class="password-modal__group">
                <label class="password-modal__label">账号</label>
                <div class="password-modal__input-wrapper password-modal__input-wrapper--readonly">
                  <span class="password-modal__input-icon">
                    <Icon name="lucide:smartphone" size="16" />
                  </span>
                  <input :value="displayPhone" type="text" class="password-modal__input" disabled />
                </div>
              </div>

              <div v-if="!isSetMode" class="password-modal__group">
                <label class="password-modal__label">旧密码</label>
                <div class="password-modal__input-wrapper">
                  <span class="password-modal__input-icon">
                    <Icon name="lucide:lock" size="16" />
                  </span>
                  <input
                    v-model="form.oldPassword"
                    :type="showOldPassword ? 'text' : 'password'"
                    class="password-modal__input"
                    placeholder="请输入当前登录密码"
                    maxlength="20"
                    @keyup.enter="handleSubmit"
                  />
                  <button class="password-modal__eye-btn" type="button" @click="showOldPassword = !showOldPassword">
                    <Icon :name="showOldPassword ? 'lucide:eye' : 'lucide:eye-off'" size="16" />
                  </button>
                </div>
              </div>

              <div class="password-modal__group">
                <label class="password-modal__label">{{ isSetMode ? '新密码' : '设置新密码' }}</label>
                <div class="password-modal__input-wrapper">
                  <span class="password-modal__input-icon">
                    <Icon name="lucide:lock-keyhole" size="16" />
                  </span>
                  <input
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    class="password-modal__input"
                    placeholder="请输入 6-20 位密码"
                    maxlength="20"
                    @keyup.enter="handleSubmit"
                  />
                  <button class="password-modal__eye-btn" type="button" @click="showPassword = !showPassword">
                    <Icon :name="showPassword ? 'lucide:eye' : 'lucide:eye-off'" size="16" />
                  </button>
                </div>
              </div>

              <div class="password-modal__group">
                <label class="password-modal__label">确认密码</label>
                <div class="password-modal__input-wrapper">
                  <span class="password-modal__input-icon">
                    <Icon name="lucide:shield-check" size="16" />
                  </span>
                  <input
                    v-model="form.confirmPassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    class="password-modal__input"
                    placeholder="请再次输入密码"
                    maxlength="20"
                    @keyup.enter="handleSubmit"
                  />
                  <button class="password-modal__eye-btn" type="button" @click="showConfirmPassword = !showConfirmPassword">
                    <Icon :name="showConfirmPassword ? 'lucide:eye' : 'lucide:eye-off'" size="16" />
                  </button>
                </div>
                <p class="password-modal__hint">密码长度需为 6-20 位</p>
              </div>
            </div>

            <div class="password-modal__actions">
              <button class="password-modal__cancel" type="button" @click="handleClose">取消</button>
              <button class="password-modal__submit" type="button" :disabled="loading" @click="handleSubmit">
                {{ loading ? '提交中...' : submitText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useUserStore } from '~/stores/user'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'set',
  },
  phone: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'success'])

const userStore = useUserStore()
const { post } = useApi()
const { showToast } = useToast()

const loading = ref(false)
const showOldPassword = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const form = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

const isSetMode = computed(() => props.mode === 'set')
const modalTitle = computed(() => (isSetMode.value ? '设置登录密码' : '修改登录密码'))
const modalDesc = computed(() => (isSetMode.value
  ? '设置完成后，下次可直接使用手机号和密码登录'
  : '为了账号安全，请先输入旧密码后再设置新密码'))
const submitText = computed(() => (isSetMode.value ? '保存密码' : '确认修改'))
const displayPhone = computed(() => props.phone || '-')

const resetForm = () => {
  Object.assign(form, {
    oldPassword: '',
    password: '',
    confirmPassword: '',
  })
  showOldPassword.value = false
  showPassword.value = false
  showConfirmPassword.value = false
}

const handleClose = () => {
  if (loading.value) return
  resetForm()
  emit('close')
}

const validateForm = () => {
  if (!isSetMode.value && !form.oldPassword) {
    showToast('请输入旧密码', 'error')
    return false
  }

  if (!form.password) {
    showToast('请输入新密码', 'error')
    return false
  }

  if (form.password.length < 6 || form.password.length > 20) {
    showToast('密码长度需为 6-20 位', 'error')
    return false
  }

  if (form.password !== form.confirmPassword) {
    showToast('两次输入的密码不一致', 'error')
    return false
  }

  if (!isSetMode.value && form.oldPassword === form.password) {
    showToast('新密码不能与旧密码相同', 'error')
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) return

  loading.value = true
  try {
    const payload = isSetMode.value
      ? { password: form.password }
      : { oldPassword: form.oldPassword, newPassword: form.password }

    const endpoint = isSetMode.value ? '/api/auth/set-password' : '/api/auth/change-password'
    const res = await post(endpoint, payload)

    if (res.code !== 200) {
      showToast(res.message || '操作失败，请稍后重试', 'error')
      return
    }

    userStore.updateUserInfo({ hasPassword: true })
    showToast(isSetMode.value ? '密码设置成功' : '密码修改成功', 'success')
    emit('success')
    handleClose()
  } catch (err) {
    showToast(err.message || '操作失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, visible => {
  if (!visible) {
    resetForm()
  }
})
</script>

<style scoped>
.password-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  padding: 20px;
}

.password-modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  padding: 28px;
}

.password-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.password-modal__header {
  text-align: center;
  margin-bottom: 24px;
}

.password-modal__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.password-modal__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.password-modal__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.password-modal__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-modal__group {
  display: flex;
  flex-direction: column;
}

.password-modal__label {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.password-modal__input-wrapper {
  display: flex;
  align-items: center;
  height: 46px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.password-modal__input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.password-modal__input-wrapper--readonly {
  background: #f8fafc;
}

.password-modal__input-icon {
  display: flex;
  align-items: center;
  padding-left: 14px;
  color: #94a3b8;
}

.password-modal__input {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 12px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
}

.password-modal__input:disabled {
  color: #64748b;
  cursor: not-allowed;
}

.password-modal__eye-btn {
  height: 100%;
  padding: 0 14px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.password-modal__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.password-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.password-modal__cancel,
.password-modal__submit {
  min-width: 110px;
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.password-modal__cancel {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.password-modal__submit {
  color: #fff;
  background: var(--color-primary-gradient);
  box-shadow: 0 8px 20px rgba(255, 107, 53, 0.24);
}

.password-modal__submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.password-modal-fade-enter-active,
.password-modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.password-modal-fade-enter-from,
.password-modal-fade-leave-to {
  opacity: 0;
}

.password-modal-scale-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.password-modal-scale-leave-active {
  transition: all 0.2s ease;
}

.password-modal-scale-enter-from,
.password-modal-scale-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

@media (max-width: 640px) {
  .password-modal {
    padding: 24px 20px 20px;
  }

  .password-modal__actions {
    flex-direction: column-reverse;
  }

  .password-modal__cancel,
  .password-modal__submit {
    width: 100%;
  }
}
</style>
