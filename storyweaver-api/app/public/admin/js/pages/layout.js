/**
 * 管理后台主布局组件
 */
const AdminLayout = {
  template: `
    <div class="admin-layout">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-logo">
          <span class="sidebar-logo-icon">🎬</span>
          <span class="sidebar-logo-text">知剧AI</span>
        </div>
        <nav class="sidebar-menu">
          <template v-for="(item, idx) in menuList" :key="item.path || idx">
            <!-- 有子菜单的父级 -->
            <template v-if="item.children">
              <div
                class="menu-item menu-parent"
                :class="{ 'parent-active': isParentActive(item) }"
                @click="toggleMenu(idx)"
              >
                <span class="menu-icon">{{ item.icon }}</span>
                <span>{{ item.title }}</span>
                <span class="menu-arrow" :class="{ expanded: expandedMenu === idx }">▸</span>
              </div>
              <div class="submenu" :class="{ open: expandedMenu === idx }">
                <router-link
                  v-for="child in item.children" :key="child.path"
                  :to="child.path"
                  class="menu-item submenu-item"
                  :class="{ active: isActive(child.path) }"
                >
                  <span>{{ child.title }}</span>
                </router-link>
              </div>
            </template>
            <!-- 普通菜单项 -->
            <router-link
              v-else
              :to="item.path"
              class="menu-item"
              :class="{ active: isActive(item.path) }"
            >
              <span class="menu-icon">{{ item.icon }}</span>
              <span>{{ item.title }}</span>
            </router-link>
          </template>
        </nav>
      </aside>

      <!-- 右侧 -->
      <div class="main-area">
        <!-- 顶栏 -->
        <header class="topbar">
          <div class="topbar-left">
            <div class="topbar-breadcrumb">
              首页 / <strong>{{ currentTitle }}</strong>
            </div>
          </div>
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="topbar-user">
              <div class="topbar-avatar">{{ nickname.charAt(0) || 'A' }}</div>
              <span class="topbar-username">{{ nickname }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="changePassword">
                  <el-icon><Lock /></el-icon> 修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </header>

        <!-- 页面内容 -->
        <main class="content-area">
          <router-view />
        </main>
      </div>

      <!-- 修改密码弹窗 -->
      <el-dialog v-model="pwdDialog.visible" title="修改密码" width="420px" :close-on-click-modal="false" destroy-on-close>
        <el-form ref="pwdFormRef" :model="pwdDialog.form" :rules="pwdDialog.rules" label-width="80px" @submit.prevent>
          <el-form-item label="原密码" prop="oldPassword">
            <el-input v-model="pwdDialog.form.oldPassword" type="password" placeholder="请输入原密码" show-password />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="pwdDialog.form.newPassword" type="password" placeholder="至少6位" show-password />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="pwdDialog.form.confirmPassword" type="password" placeholder="再次输入新密码" show-password @keyup.enter="handleChangePassword" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="pwdDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="pwdDialog.loading" @click="handleChangePassword">确认修改</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  setup() {
    const { computed, ref, reactive } = Vue
    const route = VueRouter.useRoute()
    const router = VueRouter.useRouter()

    const isLocal = window.__DEPLOY_MODE__ === 'localhost'
    const localHiddenPaths = ['/feedback', '/vip-config', '/order']

    const fullMenuList = [
      { path: '/dashboard', title: '仪表盘', icon: '📊' },
      { path: '/drama', title: '短剧管理', icon: '🎬' },
      { path: '/genre', title: '题材类型', icon: '🏷️' },
      { path: '/feedback', title: '意见反馈', icon: '💬' },
      {
        title: '兑换码', icon: '🎫', _localHide: true,
        children: [
          { path: '/redeem', title: '兑换码管理' },
          { path: '/redeem-log', title: '兑换记录' },
        ],
      },
      { path: '/vip-config', title: '会员配置', icon: '💎' },
      { path: '/order', title: '订单管理', icon: '📋' },
      { path: '/user', title: '用户管理', icon: '👥' },
      { path: '/system-config', title: '系统配置', icon: '⚙️' },
    ]

    const menuList = isLocal
      ? fullMenuList.filter(item => !item._localHide && !localHiddenPaths.includes(item.path))
      : fullMenuList

    const expandedMenu = ref(null)

    const currentTitle = computed(() => {
      for (const m of menuList) {
        if (m.children) {
          const child = m.children.find(c => route.path.startsWith(c.path))
          if (child) return child.title
        } else if (route.path.startsWith(m.path)) {
          return m.title
        }
      }
      return '管理后台'
    })

    const nickname = computed(() => {
      try {
        return JSON.parse(localStorage.getItem('admin_userinfo') || '{}').nickname || '管理员'
      } catch { return '管理员' }
    })

    function isActive(path) {
      return route.path === path || route.path.startsWith(path + '/')
    }

    function isParentActive(item) {
      return item.children && item.children.some(c => isActive(c.path))
    }

    function toggleMenu(idx) {
      expandedMenu.value = expandedMenu.value === idx ? null : idx
    }

    menuList.forEach((item, idx) => {
      if (item.children && item.children.some(c => isActive(c.path))) {
        expandedMenu.value = idx
      }
    })

    /* ==================== 修改密码 ==================== */
    const pwdFormRef = ref(null)
    const pwdDialog = reactive({
      visible: false,
      loading: false,
      form: { oldPassword: '', newPassword: '', confirmPassword: '' },
      rules: {
        oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
        newPassword: [
          { required: true, message: '请输入新密码', trigger: 'blur' },
          { min: 6, message: '密码至少6位', trigger: 'blur' },
        ],
        confirmPassword: [
          { required: true, message: '请再次输入新密码', trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (value && value !== pwdDialog.form.newPassword) {
                callback(new Error('两次输入的密码不一致'))
              } else {
                callback()
              }
            },
            trigger: 'blur',
          },
        ],
      },
    })

    async function handleChangePassword() {
      try {
        await pwdFormRef.value.validate()
      } catch { return }

      pwdDialog.loading = true
      try {
        await API.changePassword({
          oldPassword: pwdDialog.form.oldPassword,
          newPassword: pwdDialog.form.newPassword,
        })
        ElementPlus.ElMessage.success('密码修改成功，请重新登录')
        pwdDialog.visible = false
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_userinfo')
        router.push('/login')
      } catch (err) { /* 拦截器已处理 */ } finally {
        pwdDialog.loading = false
      }
    }

    /* ==================== 指令处理 ==================== */
    function handleCommand(cmd) {
      if (cmd === 'changePassword') {
        pwdDialog.form.oldPassword = ''
        pwdDialog.form.newPassword = ''
        pwdDialog.form.confirmPassword = ''
        pwdDialog.visible = true
      } else if (cmd === 'logout') {
        ElementPlus.ElMessageBox.confirm('确定退出登录吗？', '提示', {
          confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
        }).then(() => {
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_userinfo')
          router.push('/login')
          ElementPlus.ElMessage.success('已退出登录')
        }).catch(() => {})
      }
    }

    return {
      menuList, expandedMenu, currentTitle, nickname,
      isActive, isParentActive, toggleMenu, handleCommand,
      pwdFormRef, pwdDialog, handleChangePassword,
    }
  }
}
