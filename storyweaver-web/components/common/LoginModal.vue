<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="login-overlay" @click.self="handleClose">
        <Transition name="modal-scale">
          <div v-if="visible" class="login-modal">
            <button class="login-modal__close" @click="handleClose">
              <Icon name="lucide:x" size="20" />
            </button>

            <!-- 左侧品牌区 -->
            <div class="login-modal__brand">
              <div class="login-modal__brand-content">
                <div class="login-modal__logo">
                  <div class="login-modal__logo-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect width="32" height="32" rx="8" fill="white" fill-opacity="0.2"/>
                      <path d="M8 12L16 8L24 12V20L16 24L8 20V12Z" fill="white" fill-opacity="0.9"/>
                      <path d="M16 8V24M8 12L24 20M24 12L8 20" stroke="white" stroke-opacity="0.3" stroke-width="0.5"/>
                    </svg>
                  </div>
                  <span class="login-modal__logo-text">知剧AI</span>
                </div>
                <p class="login-modal__slogan">{{ brandSlogan }}</p>
                <div class="login-modal__features">
                  <div
                    v-for="feature in brandFeatures"
                    :key="feature.title"
                    class="login-modal__feature"
                  >
                    <div class="login-modal__feature-icon"><Icon :name="feature.icon" size="18" /></div>
                    <div>
                      <span class="login-modal__feature-title">{{ feature.title }}</span>
                      <p class="login-modal__feature-desc">{{ feature.desc }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧登录区 -->
            <div class="login-modal__form">

              <!-- ====== 视图1：登录表单 ====== -->
              <template v-if="currentView === 'login'">

                <!-- network 模式：显示 tab 切换 -->
                <div v-if="!isLocalMode" class="login-modal__tabs">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    class="login-modal__tab"
                    :class="{ 'login-modal__tab--active': activeTab === tab.key }"
                    @click="activeTab = tab.key"
                  >{{ tab.label }}</button>
                </div>

                <!-- localhost 模式：直接显示标题 -->
                <div v-else class="login-modal__local-header">
                  <h3 class="login-modal__local-title">登录 / 注册</h3>
                  <p class="login-modal__local-desc">首次输入手机号将自动创建账号</p>
                </div>

                <!-- 手机号验证码登录（仅 network 模式） -->
                <div v-if="!isLocalMode && activeTab === 'phone'" class="login-modal__panel">
                  <div class="login-modal__input-group">
                    <div class="login-modal__input-wrapper">
                      <span class="login-modal__input-prefix">+86</span>
                      <input v-model="phoneForm.phone" type="tel" class="login-modal__input" placeholder="请输入手机号" maxlength="11" />
                    </div>
                  </div>
                  <div class="login-modal__input-group">
                    <div class="login-modal__input-wrapper login-modal__input-wrapper--code">
                      <input v-model="phoneForm.code" type="text" class="login-modal__input" placeholder="请输入验证码" maxlength="6" />
                      <button class="login-modal__code-btn" :disabled="!isPhoneValid || codeCooldown > 0 || codeSending || codeLocked" @click="handleSendCode">
                        {{ codeSending ? '发送中...' : (codeCooldown > 0 ? `${codeCooldown}s后可重发` : '获取验证码') }}
                      </button>
                    </div>
                  </div>
                  <Transition name="error-fade">
                    <div v-if="showCaptcha" class="login-modal__captcha-group">
                      <label class="login-modal__label">图片验证码</label>
                      <div class="login-modal__captcha-row">
                        <input v-model="captchaForm.text" type="text" class="login-modal__captcha-input" placeholder="请输入图中字符" maxlength="4" @keyup.enter="handleSendCodeWithCaptcha" />
                        <div class="login-modal__captcha-img" @click="refreshCaptcha" v-html="captchaForm.svg" />
                      </div>
                      <button class="login-modal__captcha-submit" :disabled="codeSending" @click="handleSendCodeWithCaptcha">
                        {{ codeSending ? '发送中...' : '验证并发送' }}
                      </button>
                    </div>
                  </Transition>
                  <button class="login-modal__submit" :disabled="phoneLoading || !isPhoneValid || !isCodeValid" @click="handlePhoneLogin">
                    {{ phoneLoading ? '登录中...' : '登录 / 注册' }}
                  </button>
                </div>

                <!-- 账号密码登录（两种模式通用） -->
                <div v-if="isLocalMode || activeTab === 'password'" class="login-modal__panel">
                  <div class="login-modal__input-group">
                    <div class="login-modal__input-wrapper">
                      <span class="login-modal__input-prefix">+86</span>
                      <input v-model="pwdForm.phone" type="tel" class="login-modal__input" placeholder="请输入手机号" maxlength="11" />
                    </div>
                  </div>
                  <div class="login-modal__input-group">
                    <div class="login-modal__input-wrapper">
                      <span class="login-modal__input-icon"><Icon name="lucide:lock" size="16" color="#bbb" /></span>
                      <input v-model="pwdForm.password" :type="showPwd ? 'text' : 'password'" class="login-modal__input" placeholder="请输入密码（6-20位）" maxlength="20" @keyup.enter="handlePasswordLogin" />
                      <button class="login-modal__eye-btn" type="button" @click="showPwd = !showPwd">
                        <Icon :name="showPwd ? 'lucide:eye' : 'lucide:eye-off'" size="16" color="#bbb" />
                      </button>
                    </div>
                  </div>
                  <button class="login-modal__submit" :disabled="pwdLoading || !isPwdPhoneValid || !isPwdValid" @click="handlePasswordLogin">
                    {{ pwdLoading ? '登录中...' : (isLocalMode ? '登录 / 注册' : '登录') }}
                  </button>
                  <p v-if="!isLocalMode" class="login-modal__switch-tip">还没设置密码？<a href="javascript:;" @click="activeTab = 'phone'">使用手机号登录</a></p>
                </div>

                <p class="login-modal__agreement">登录即是同意 <a href="javascript:;">《用户协议》</a> 和 <a href="javascript:;">《隐私协议》</a></p>
              </template>

              <!-- ====== 视图2：首次登录设置密码（仅 network 模式验证码登录后） ====== -->
              <template v-if="currentView === 'setPassword'">
                <div class="login-modal__set-pwd">
                  <div class="login-modal__set-pwd-header">
                    <div class="login-modal__set-pwd-icon">
                      <Icon name="lucide:shield-check" size="32" color="var(--color-primary)" />
                    </div>
                    <h3 class="login-modal__set-pwd-title">设置登录密码</h3>
                    <p class="login-modal__set-pwd-desc">设置密码后，下次可直接用密码快速登录</p>
                  </div>
                  <div class="login-modal__input-group">
                    <label class="login-modal__label">账号</label>
                    <div class="login-modal__input-wrapper login-modal__input-wrapper--readonly">
                      <span class="login-modal__input-icon"><Icon name="lucide:smartphone" size="16" color="#bbb" /></span>
                      <input :value="maskedPhone" type="text" class="login-modal__input" disabled />
                    </div>
                  </div>
                  <div class="login-modal__input-group">
                    <label class="login-modal__label">密码</label>
                    <div class="login-modal__input-wrapper">
                      <span class="login-modal__input-icon"><Icon name="lucide:lock" size="16" color="#bbb" /></span>
                      <input v-model="setPwdForm.password" :type="showSetPwd ? 'text' : 'password'" class="login-modal__input" placeholder="请输入6-20位密码" maxlength="20" @keyup.enter="handleSetPassword" />
                      <button class="login-modal__eye-btn" type="button" @click="showSetPwd = !showSetPwd">
                        <Icon :name="showSetPwd ? 'lucide:eye' : 'lucide:eye-off'" size="16" color="#bbb" />
                      </button>
                    </div>
                    <p v-if="setPwdForm.password && setPwdForm.password.length < 6" class="login-modal__field-hint login-modal__field-hint--warn">密码至少6位</p>
                  </div>
                  <div class="login-modal__set-pwd-actions">
                    <button class="login-modal__submit" :disabled="setPwdLoading || !isSetPwdValid" @click="handleSetPassword">
                      {{ setPwdLoading ? '保存中...' : '保存密码' }}
                    </button>
                    <button class="login-modal__skip-btn" @click="handleSkipSetPassword">跳过，以后再说</button>
                  </div>
                </div>
              </template>

            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useUserStore } from '~/stores/user'

defineProps({ visible: Boolean })
const emit = defineEmits(['close', 'success'])

const userStore = useUserStore()
const { get, post } = useApi()
const { showToast } = useToast()

/** 是否为本地开源模式 */
const isLocalMode = userStore.isLocalMode

/* ===== 视图状态 ===== */
const currentView = ref('login')

const tabs = [
  { key: 'phone', label: '手机号登录' },
  { key: 'password', label: '密码登录' },
]
/* localhost 模式默认密码登录 */
const activeTab = ref(isLocalMode ? 'password' : 'phone')

/* ===== 通用状态 ===== */
const errorMsg = ref('')
const codeCooldown = ref(0)
let cooldownTimer = null
const codeSending = ref(false)
const codeLocked = ref(false)

/* ===== 图片验证码 ===== */
const showCaptcha = ref(false)
const captchaForm = reactive({ id: '', text: '', svg: '' })

/* ===== 手机号登录 ===== */
const phoneForm = reactive({ phone: '', code: '' })
const phoneLoading = ref(false)

/* ===== 密码登录 ===== */
const pwdForm = reactive({ phone: '', password: '' })
const pwdLoading = ref(false)
const showPwd = ref(false)

/* ===== 设置密码 ===== */
const setPwdForm = reactive({ password: '' })
const setPwdLoading = ref(false)
const showSetPwd = ref(false)
const newUserPhone = ref('')

/* ===== 计算属性 ===== */
const isPhoneValid = computed(() => /^1[3-9]\d{9}$/.test(phoneForm.phone))
const isCodeValid = computed(() => /^\d{6}$/.test(phoneForm.code))
const isPwdPhoneValid = computed(() => /^1[3-9]\d{9}$/.test(pwdForm.phone))
const isPwdValid = computed(() => pwdForm.password.length >= 6)
const isSetPwdValid = computed(() => setPwdForm.password.length >= 6 && setPwdForm.password.length <= 20)
const maskedPhone = computed(() => newUserPhone.value || '')
const brandSlogan = computed(() => (isLocalMode.value ? '开源版登录后即可继续创作' : '登录后继续创作你的短剧项目'))
const brandFeatures = computed(() => [
  {
    icon: 'lucide:gift',
    title: '永久免费创作短剧剧本',
    desc: '开源可用，商用版也可先体验再升级',
  },
  {
    icon: 'lucide:file-pen-line',
    title: '免费快速写剧本',
    desc: '灵感来了马上开写，持续推进创作',
  },
  {
    icon: 'lucide:book-open-text',
    title: '免费小说转剧本',
    desc: '改编、拆解、生成一站完成',
  },
])

/* ===== 关闭弹窗 ===== */
const handleClose = () => {
  currentView.value = 'login'
  activeTab.value = isLocalMode ? 'password' : 'phone'
  errorMsg.value = ''
  showCaptcha.value = false
  Object.assign(captchaForm, { id: '', text: '', svg: '' })
  setPwdForm.password = ''
  showSetPwd.value = false
  newUserPhone.value = ''
  emit('close')
}

const showError = (msg) => { showToast(msg, 'error') }

/* ===== 倒计时 ===== */
const startCooldown = () => {
  codeCooldown.value = 60
  cooldownTimer = setInterval(() => {
    codeCooldown.value--
    if (codeCooldown.value <= 0 && cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null }
  }, 1000)
}

/* ===== 刷新图片验证码 ===== */
const refreshCaptcha = async () => {
  try {
    const res = await get('/api/auth/captcha')
    if (res.code === 200 && res.data) { Object.assign(captchaForm, { id: res.data.captcha_id, svg: res.data.captcha_svg, text: '' }) }
  } catch (err) { /* 静默 */ }
}

/* ===== 发送验证码 ===== */
const handleSendCode = async () => {
  if (codeLocked.value || codeSending.value) return
  codeLocked.value = true
  codeSending.value = true
  errorMsg.value = ''
  try {
    const res = await post('/api/auth/send-code', { phone: phoneForm.phone })
    if (res.code === 200) {
      if (res.data.need_captcha) {
        showCaptcha.value = true
        Object.assign(captchaForm, { id: res.data.captcha_id, svg: res.data.captcha_svg, text: '' })
        showError(res.data.message || '请完成图片验证码')
      } else { showCaptcha.value = false; startCooldown() }
    } else { showError(res.message || '验证码发送失败') }
  } catch (err) { showError(err.message || '网络错误，请稍后重试') }
  finally { codeSending.value = false; setTimeout(() => { codeLocked.value = false }, 1000) }
}

/* ===== 带图片验证码发送 ===== */
const handleSendCodeWithCaptcha = async () => {
  if (!captchaForm.text) { showError('请输入图片验证码'); return }
  codeSending.value = true
  errorMsg.value = ''
  try {
    const res = await post('/api/auth/send-code', { phone: phoneForm.phone, captcha_id: captchaForm.id, captcha_text: captchaForm.text })
    if (res.code === 200) {
      if (res.data.need_captcha) {
        Object.assign(captchaForm, { id: res.data.captcha_id, svg: res.data.captcha_svg, text: '' })
        showError(res.data.message || '图片验证码错误')
      } else { showCaptcha.value = false; Object.assign(captchaForm, { id: '', text: '', svg: '' }); startCooldown() }
    } else { showError(res.message || '验证码发送失败') }
  } catch (err) { showError(err.message || '网络错误，请稍后重试') }
  finally { codeSending.value = false }
}

/* ===== 手机验证码登录（仅 network 模式） ===== */
const handlePhoneLogin = async () => {
  if (!isPhoneValid.value || !isCodeValid.value) return
  phoneLoading.value = true
  try {
    const res = await post('/api/auth/login-by-phone', { phone: phoneForm.phone, code: phoneForm.code })
    if (res.code === 200) {
      userStore.setLogin(res.data)
      if (res.data.needSetPassword) {
        newUserPhone.value = phoneForm.phone
        setPwdForm.password = ''
        currentView.value = 'setPassword'
      } else { emit('success'); handleClose() }
    } else { showError(res.message || '登录失败') }
  } catch (err) { showError(err.message || '网络错误，请稍后重试') }
  finally { phoneLoading.value = false }
}

/* ===== 账号密码登录（两种模式通用） ===== */
const handlePasswordLogin = async () => {
  if (!isPwdPhoneValid.value || !isPwdValid.value) return
  pwdLoading.value = true
  try {
    const res = await post('/api/auth/login', { phone: pwdForm.phone, password: pwdForm.password })
    if (res.code === 200) {
      userStore.setLogin(res.data)
      if (res.data.isNewUser) {
        showToast('账号创建成功，已自动登录', 'success')
      }
      emit('success')
      handleClose()
    } else { showError(res.message || '登录失败') }
  } catch (err) { showError(err.message || '网络错误，请稍后重试') }
  finally { pwdLoading.value = false }
}

/* ===== 设置密码（仅 network 模式验证码登录后） ===== */
const handleSetPassword = async () => {
  if (!isSetPwdValid.value) return
  setPwdLoading.value = true
  try {
    const res = await post('/api/auth/set-password', { password: setPwdForm.password })
    if (res.code === 200) {
      showToast('密码设置成功，下次可用密码直接登录', 'success')
      userStore.updateUserInfo({ hasPassword: true })
      emit('success'); handleClose()
    } else { showError(res.message || '设置失败') }
  } catch (err) { showError(err.message || '网络错误，请稍后重试') }
  finally { setPwdLoading.value = false }
}

/* ===== 跳过设置密码 ===== */
const handleSkipSetPassword = () => { emit('success'); handleClose() }

watch(activeTab, () => { errorMsg.value = '' })
onUnmounted(() => { if (cooldownTimer) clearInterval(cooldownTimer) })
</script>

<style scoped>
.login-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.login-modal {
  position: relative; display: flex; width: 760px; min-height: 350px;
  background: #fff; border-radius: 20px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1);
}
.login-modal__close {
  position: absolute; top: 16px; right: 16px; z-index: 10;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(0,0,0,0.04); color: #999; transition: all 0.2s;
  border: none; cursor: pointer;
}
.login-modal__close:hover { background: rgba(0,0,0,0.08); color: #333; }

/* 左侧品牌区 */
.login-modal__brand {
  width: 320px; flex-shrink: 0;
  background: linear-gradient(160deg, #ff6b35 0%, #f7418f 50%, #e83e8c 100%);
  padding: 28px 24px 24px; display: flex; flex-direction: column; justify-content: flex-start;
  position: relative; overflow: hidden;
}
.login-modal__brand::before {
  content: ''; position: absolute; top: -40px; right: -40px;
  width: 160px; height: 160px; background: rgba(255,255,255,0.1);
  border-radius: 50%; filter: blur(30px);
}
.login-modal__brand::after {
  content: ''; position: absolute; bottom: -30px; left: -20px;
  width: 120px; height: 120px; background: rgba(255,255,255,0.08);
  border-radius: 50%; filter: blur(25px);
}
.login-modal__brand-content { position: relative; z-index: 1; margin-top: 6px; }
.login-modal__logo { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.login-modal__logo-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
.login-modal__logo-text { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: 1px; }
.login-modal__slogan { font-size: 13px; color: rgba(255,255,255,0.82); margin-bottom: 24px; }
.login-modal__features { display: flex; flex-direction: column; gap: 18px; }
.login-modal__feature { display: flex; align-items: flex-start; gap: 12px; }
.login-modal__feature-icon {
  width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.15); border-radius: 10px; color: #fff;
}
.login-modal__feature-title { font-size: 13.5px; color: #fff; font-weight: 600; line-height: 1.4; }
.login-modal__feature-desc { font-size: 11.5px; color: rgba(255,255,255,0.68); margin-top: 3px; line-height: 1.5; }

/* 右侧登录区 */
.login-modal__form { flex: 1; padding: 24px 28px 18px; display: flex; flex-direction: column; }
.login-modal__tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
.login-modal__tab {
  flex: 1; padding: 10px 0; font-size: 14px; color: #999; background: none; border: none;
  border-bottom: 2px solid transparent; transition: all 0.3s; font-weight: 500;
  white-space: nowrap; cursor: pointer;
}
.login-modal__tab:hover { color: #666; }
.login-modal__tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }

/* localhost 模式标题 */
.login-modal__local-header { margin-bottom: 18px; }
.login-modal__local-title { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
.login-modal__local-desc { font-size: 13px; color: #999; }

.login-modal__panel { display: flex; flex-direction: column; }
.login-modal__input-group { margin-bottom: 14px; }
.login-modal__label { display: block; font-size: 13px; font-weight: 500; color: #333; margin-bottom: 6px; }
.login-modal__input-wrapper {
  display: flex; align-items: center; height: 44px;
  border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden;
  transition: all 0.3s; background: #fff;
}
.login-modal__input-wrapper:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.login-modal__input-wrapper--readonly { background: #f9f9f9; }
.login-modal__input-prefix {
  padding: 0 12px; font-size: 14px; color: #333; font-weight: 500;
  border-right: 1px solid #e5e5e5; height: 100%; display: flex; align-items: center;
  background: #fafafa; flex-shrink: 0;
}
.login-modal__input-icon { padding: 0 0 0 12px; display: flex; align-items: center; flex-shrink: 0; }
.login-modal__input {
  flex: 1; height: 100%; padding: 0 12px; font-size: 14px;
  color: #333; border: none; outline: none; background: transparent;
}
.login-modal__input::placeholder { color: #bbb; }
.login-modal__input:disabled { color: #999; cursor: not-allowed; }
.login-modal__eye-btn {
  padding: 0 12px; height: 100%; display: flex; align-items: center;
  background: none; border: none; cursor: pointer; flex-shrink: 0;
}
.login-modal__eye-btn:hover { opacity: 0.7; }
.login-modal__field-hint { margin-top: 4px; font-size: 12px; padding-left: 2px; }
.login-modal__field-hint--warn { color: #f59e0b; }
.login-modal__input-wrapper--code .login-modal__input { flex: 1; }
.login-modal__code-btn {
  padding: 0 16px; height: calc(100% - 8px); margin-right: 4px;
  background: var(--color-primary); color: #fff; border-radius: 8px;
  font-size: 13px; font-weight: 500; white-space: nowrap; flex-shrink: 0;
  transition: all 0.2s; cursor: pointer; border: none;
}
.login-modal__code-btn:hover:not(:disabled) { background: var(--color-primary-light); }
.login-modal__code-btn:disabled { background: #e5e5e5; color: #999; cursor: not-allowed; }

/* 提交按钮 */
.login-modal__submit {
  width: 100%; height: 46px; margin-top: 4px;
  background: var(--color-primary-gradient); color: #fff; border: none; border-radius: 10px;
  font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(255,107,53,0.3);
}
.login-modal__submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,53,0.4); }
.login-modal__submit:active:not(:disabled) { transform: translateY(0); }
.login-modal__submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

.login-modal__switch-tip { margin-top: 12px; text-align: center; font-size: 13px; color: #999; }
.login-modal__switch-tip a { color: var(--color-primary); text-decoration: none; font-weight: 500; }
.login-modal__switch-tip a:hover { text-decoration: underline; }
.login-modal__agreement { margin-top: 16px; padding-top: 0; text-align: center; font-size: 12px; color: #bbb; }
.login-modal__agreement a { color: var(--color-primary); text-decoration: none; }
.login-modal__agreement a:hover { text-decoration: underline; }

/* 设置密码视图 */
.login-modal__set-pwd { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.login-modal__set-pwd-header { text-align: center; margin-bottom: 28px; }
.login-modal__set-pwd-icon {
  width: 56px; height: 56px; margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-primary-bg, #fff5f0); border-radius: 16px;
}
.login-modal__set-pwd-title { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
.login-modal__set-pwd-desc { font-size: 13px; color: #999; }
.login-modal__set-pwd-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.login-modal__skip-btn {
  width: 100%; height: 42px; background: none; border: 1px solid #e5e5e5;
  border-radius: 10px; font-size: 14px; color: #999; cursor: pointer; transition: all 0.2s;
}
.login-modal__skip-btn:hover { border-color: #ccc; color: #666; background: #fafafa; }

/* 图片验证码 */
.login-modal__captcha-group { margin-bottom: 16px; padding: 14px; background: #fafafa; border-radius: 10px; border: 1px solid #e5e5e5; }
.login-modal__captcha-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; margin-bottom: 10px; }
.login-modal__captcha-input {
  flex: 1; height: 40px; padding: 0 12px; font-size: 15px; letter-spacing: 4px;
  font-weight: 600; color: #333; border: 1px solid #e5e5e5; border-radius: 8px;
  outline: none; background: #fff; transition: border-color 0.3s;
}
.login-modal__captcha-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-bg); }
.login-modal__captcha-img {
  width: 120px; height: 40px; flex-shrink: 0; border-radius: 8px; overflow: hidden;
  cursor: pointer; border: 1px solid #e5e5e5; background: #f5f5f5;
  display: flex; align-items: center; justify-content: center; transition: transform 0.2s;
}
.login-modal__captcha-img:hover { transform: scale(1.02); }
.login-modal__captcha-img :deep(svg) { width: 100%; height: 100%; }
.login-modal__captcha-submit {
  width: 100%; height: 38px; background: var(--color-primary); color: #fff;
  border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.2s;
}
.login-modal__captcha-submit:hover:not(:disabled) { background: var(--color-primary-light); }
.login-modal__captcha-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* 动画 */
.modal-fade-enter-active { transition: opacity 0.3s ease; }
.modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-scale-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-scale-leave-active { transition: all 0.25s ease-in; }
.modal-scale-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); }
.modal-scale-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }
.error-fade-enter-active { transition: all 0.3s ease; }
.error-fade-leave-active { transition: all 0.2s ease; }
.error-fade-enter-from, .error-fade-leave-to { opacity: 0; transform: translateY(-8px); }

/* 响应式 */
@media (max-width: 800px) {
  .login-modal { width: calc(100vw - 32px); flex-direction: column; min-height: auto; }
  .login-modal__brand { width: 100%; padding: 24px 20px; }
  .login-modal__features { display: none; }
  .login-modal__form { padding: 24px 20px; }
}
</style>
