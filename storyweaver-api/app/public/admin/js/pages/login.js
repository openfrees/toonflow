/**
 * 登录页组件
 */
const LoginPage = {
  template: `
    <div class="login-page">
      <div class="login-bg-circle login-bg-circle-1"></div>
      <div class="login-bg-circle login-bg-circle-2"></div>
      <div class="login-bg-circle login-bg-circle-3"></div>

      <div class="login-card">
        <div class="login-header">
          <span class="login-icon">🎬</span>
          <h1 class="login-title">知剧AI</h1>
          <p class="login-subtitle">短剧管理后台</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" :disabled="isLocked" @keyup.enter="handleLogin" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="请输入密码" prefix-icon="Lock" show-password :disabled="isLocked" @keyup.enter="handleLogin" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" :disabled="isLocked" style="width:100%;height:44px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:4px;" @click="handleLogin">
              {{ isLocked ? lockCountdownText : (loading ? '登录中...' : '登  录') }}
            </el-button>
          </el-form-item>
        </el-form>

        <transition name="el-fade-in">
          <div v-if="loginWarning" class="login-warning">{{ loginWarning }}</div>
        </transition>
      </div>
    </div>
  `,
  setup() {
    const { ref, reactive, computed, onBeforeUnmount } = Vue
    const router = VueRouter.useRouter()

    const formRef = ref(null)
    const loading = ref(false)
    const form = reactive({ username: '', password: '' })
    const rules = {
      username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
      password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    }

    /* 锁定状态 */
    const lockSeconds = ref(0)
    const remainAttempts = ref(5)
    let lockTimer = null

    const isLocked = computed(() => lockSeconds.value > 0)

    const lockCountdownText = computed(() => {
      const m = Math.floor(lockSeconds.value / 60)
      const s = lockSeconds.value % 60
      return `已锁定 ${m}:${String(s).padStart(2, '0')}`
    })

    const loginWarning = computed(() => {
      if (isLocked.value) {
        return `登录失败次数过多，请 ${lockCountdownText.value.replace('已锁定 ', '')} 后再试`
      }
      if (remainAttempts.value < 5 && remainAttempts.value > 0) {
        return `密码错误，还剩 ${remainAttempts.value} 次尝试机会`
      }
      return ''
    })

    function startLockCountdown(seconds) {
      clearInterval(lockTimer)
      lockSeconds.value = seconds
      lockTimer = setInterval(() => {
        lockSeconds.value--
        if (lockSeconds.value <= 0) {
          clearInterval(lockTimer)
          lockTimer = null
          remainAttempts.value = 5
        }
      }, 1000)
    }

    onBeforeUnmount(() => {
      clearInterval(lockTimer)
    })

    async function handleLogin() {
      if (isLocked.value) return

      try {
        await formRef.value.validate()
      } catch { return }

      loading.value = true
      try {
        const res = await API.login(form)
        localStorage.setItem('admin_token', res.data.token)
        localStorage.setItem('admin_userinfo', JSON.stringify(res.data.userInfo))
        ElementPlus.ElMessage.success('登录成功')
        remainAttempts.value = 5
        router.push('/dashboard')
      } catch (err) {
        /* 从响应中解析锁定信息（绕过拦截器的reject） */
        const axiosErr = err
        const resData = axiosErr?.response?.data?.data || axiosErr?.data
        if (resData) {
          if (resData.locked) {
            startLockCountdown(resData.remainSeconds)
          } else if (typeof resData.remainAttempts === 'number') {
            remainAttempts.value = resData.remainAttempts
          }
        }
      } finally {
        loading.value = false
      }
    }

    return { formRef, form, rules, loading, handleLogin, isLocked, lockCountdownText, loginWarning, lockSeconds, remainAttempts }
  }
}
