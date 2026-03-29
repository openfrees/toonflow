<template>
  <div class="home">

    <!-- Hero Banner -->
    <section class="hero">
      <div class="hero__content">
        <div class="hero__badge">
          <Icon :name="heroConfig.badgeIcon" size="14" />
          <span>{{ heroConfig.badge }}</span>
        </div>
        <h1 class="hero__title">
          <span class="hero__title-line">{{ heroConfig.titleLine }}</span>
          <span class="hero__title-highlight">{{ heroConfig.titleHighlight }}</span>
        </h1>
        <p class="hero__desc">{{ heroConfig.desc }}</p>

        <div class="hero__highlight-list">
          <div
            v-for="item in heroConfig.highlights"
            :key="item.title"
            class="hero__highlight-item"
          >
            <div class="hero__highlight-icon">
              <Icon :name="item.icon" size="16" />
            </div>
            <div class="hero__highlight-copy">
              <span class="hero__highlight-title">{{ item.title }}</span>
              <span class="hero__highlight-desc">{{ item.desc }}</span>
            </div>
          </div>
        </div>

        <div class="hero__actions">
          <button class="hero__btn hero__btn--primary" @click="handleNavClick('/write')">
            <Icon name="lucide:pen-line" size="18" />
            <span>{{ heroConfig.primaryActionText }}</span>
          </button>
          <button
            class="hero__btn hero__btn--secondary"
            @click="handleSecondaryAction"
          >
            <Icon :name="heroConfig.secondaryActionIcon" size="18" />
            <span>{{ heroConfig.secondaryActionText }}</span>
          </button>
        </div>

        <div class="hero__resource-links">
          <button
            v-for="link in heroConfig.resourceLinks"
            :key="link.label"
            class="hero__resource-link"
            :class="{ 'hero__resource-link--official': link.emphasis === 'official' }"
            @click="openExternal(link.url)"
          >
            <Icon :name="link.icon" size="15" />
            <span>{{ link.label }}</span>
          </button>
        </div>

        <div class="hero__stats">
          <div
            v-for="(stat, index) in heroConfig.stats"
            :key="stat.label"
            class="hero__stat-group"
          >
            <div class="hero__stat">
              <span class="hero__stat-value">{{ stat.value }}</span>
              <span class="hero__stat-label">{{ stat.label }}</span>
            </div>
            <div
              v-if="index < heroConfig.stats.length - 1"
              class="hero__stat-divider"
            ></div>
          </div>
        </div>
      </div>
      <div class="hero__visual">
        <!-- 模拟编辑器窗口 -->
        <div class="hero__editor">
          <div class="hero__editor-bar">
            <div class="hero__editor-dots">
              <span></span><span></span><span></span>
            </div>
            <div class="hero__editor-title">
              <Icon name="lucide:file-text" size="13" />
              <span>重生后我成了顶流编剧.zhiju</span>
            </div>
          </div>
          <div class="hero__editor-body">
            <div class="hero__editor-line hero__editor-line--heading">{{ heroConfig.visual.heading }}</div>
            <div class="hero__editor-line hero__editor-line--scene">
              <span class="hero__editor-tag">场景</span>
              {{ heroConfig.visual.scene }}
            </div>
            <div class="hero__editor-line hero__editor-line--action">{{ heroConfig.visual.action1 }}</div>
            <div class="hero__editor-line hero__editor-line--dialog">
              <span class="hero__editor-role">{{ heroConfig.visual.role1 }}</span>
              {{ heroConfig.visual.dialog1 }}
            </div>
            <div class="hero__editor-line hero__editor-line--dialog">
              <span class="hero__editor-role">{{ heroConfig.visual.role2 }}</span>
              {{ heroConfig.visual.dialog2 }}
            </div>
            <div class="hero__editor-line hero__editor-line--action">{{ heroConfig.visual.action2 }}</div>
            <div class="hero__editor-cursor"></div>
          </div>
          <!-- 侧边浮动标签 -->
          <div class="hero__editor-float hero__editor-float--1">
            <Icon :name="heroConfig.visual.float1Icon" size="14" />
            <span>{{ heroConfig.visual.float1Text }}</span>
          </div>
          <div class="hero__editor-float hero__editor-float--2">
            <Icon :name="heroConfig.visual.float2Icon" size="14" />
            <span>{{ heroConfig.visual.float2Text }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 核心功能区 -->
    <section id="features" class="features">
      <div class="section-heading">
        <span class="section-heading__tag">核心功能</span>
        <h2 class="section-heading__title">两大创作模式，满足不同需求</h2>
        <p class="section-heading__desc">无论你是从零开始，还是基于已有小说改编，知剧都能帮你高效完成</p>
      </div>

      <div class="features__grid">
        <div
          v-for="(feature, index) in coreFeatures"
          :key="feature.title"
          class="feature-card"
          :class="`feature-card--${index + 1}`"
          @click="handleNavClick(feature.path)"
        >
          <div class="feature-card__icon-wrap" :class="`feature-card__icon-wrap--${index + 1}`">
            <Icon :name="feature.icon" size="28" />
          </div>
          <div class="feature-card__body">
            <h3 class="feature-card__title">{{ feature.title }}</h3>
            <p class="feature-card__desc">{{ feature.desc }}</p>
            <ul class="feature-card__highlights">
              <li v-for="item in feature.highlights" :key="item">
                <Icon name="lucide:check" size="14" class="feature-card__check" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
          <div class="feature-card__cta">
            <span>{{ feature.cta }}</span>
            <Icon name="lucide:arrow-right" size="16" />
          </div>
        </div>
      </div>
    </section>

    <!-- 平台能力展示 -->
    <section class="capabilities">
      <div class="section-heading">
        <span class="section-heading__tag">平台能力</span>
        <h2 class="section-heading__title">全流程智能辅助，从创意到成片</h2>
        <p class="section-heading__desc">覆盖短剧创作的每一个环节，知剧就是你的专属编剧助手</p>
      </div>

      <div class="capabilities__grid">
        <div
          v-for="cap in aiCapabilities"
          :key="cap.title"
          class="cap-card"
        >
          <div class="cap-card__icon" :style="{ background: cap.color }">
            <Icon :name="cap.icon" size="22" color="#fff" />
          </div>
          <h4 class="cap-card__title">{{ cap.title }}</h4>
          <p class="cap-card__desc">{{ cap.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 创作流程 -->
    <section class="workflow">
      <div class="section-heading">
        <span class="section-heading__tag">创作流程</span>
        <h2 class="section-heading__title">四步完成专业短剧剧本</h2>
        <p class="section-heading__desc">简单直观的创作流程，即使零基础也能快速上手</p>
      </div>

      <div class="workflow__steps">
        <div
          v-for="(step, index) in workflowSteps"
          :key="step.title"
          class="step-card"
        >
          <div class="step-card__number">{{ String(index + 1).padStart(2, '0') }}</div>
          <div class="step-card__icon">
            <Icon :name="step.icon" size="24" />
          </div>
          <h4 class="step-card__title">{{ step.title }}</h4>
          <p class="step-card__desc">{{ step.desc }}</p>
          <div v-if="index < workflowSteps.length - 1" class="step-card__arrow">
            <Icon name="lucide:chevron-right" size="20" />
          </div>
        </div>
      </div>
    </section>

    <!-- 底部 CTA -->
    <section class="bottom-cta">
      <div class="bottom-cta__bg"></div>
      <div class="bottom-cta__content">
        <h2 class="bottom-cta__title">准备好开始创作了吗？</h2>
        <p class="bottom-cta__desc">注册即可免费体验，让知剧帮你写出下一部爆款短剧</p>
        <button class="bottom-cta__btn" @click="handleNavClick('/write')">
          <Icon name="lucide:rocket" size="18" />
          <span>免费开始创作</span>
        </button>
      </div>
    </section>

  </div>
</template>

<script setup>
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const runtimeConfig = useRuntimeConfig()

useSeo()

const EXTERNAL_LINKS = Object.freeze({
  official: runtimeConfig.public.officialSiteUrl,
  github: runtimeConfig.public.githubRepoUrl,
  gitee: runtimeConfig.public.giteeRepoUrl,
})

/**
 * 首页 Hero 根据部署模式切换展示内容
 * 本地模式强调开源/本地部署/数据安全，商业模式强调免费体验/开源/可私有部署
 */
const heroConfig = computed(() => {
  if (userStore.isLocalMode) {
    return {
      badge: '开源版 · 本地部署优先',
      badgeIcon: 'lucide:shield-check',
      titleLine: '用知剧搭建',
      titleHighlight: '你的本地 AI 短剧工作台',
      desc: '开源永久免费，支持本地部署与私有化使用。创作数据留在自己的环境里，更适合注重可控性和数据安全的团队与个人。',
      primaryActionText: '开始本地创作',
      secondaryActionText: '访问官网',
      secondaryActionIcon: 'lucide:globe',
      highlights: [
        { icon: 'lucide:gift', title: '永久免费', desc: '开源版可长期使用' },
        { icon: 'lucide:server', title: '本地部署', desc: '部署到自己的机器或内网' },
        { icon: 'lucide:shield', title: '数据安全', desc: '创作数据更可控、更安心' },
        { icon: 'lucide:git-branch', title: '开源可扩展', desc: '支持二次开发与自定义集成' },
      ],
      resourceLinks: [
        { label: '官网地址', icon: 'lucide:globe', url: EXTERNAL_LINKS.official, emphasis: 'official' },
        { label: 'Gitee 开源', icon: 'lucide:folder-git-2', url: EXTERNAL_LINKS.gitee },
        { label: 'GitHub 开源', icon: 'lucide:github', url: EXTERNAL_LINKS.github },
      ],
      stats: [
        { value: '100%', label: '永久免费' },
        { value: 'Local', label: '支持本地部署' },
        { value: 'Secure', label: '数据更安全' },
      ],
      visual: {
        heading: '本地部署 · 创作空间',
        scene: '私有环境 · 任意设备 · 安心创作',
        action1: '知剧已部署到你的本地环境，剧本、角色和分镜数据都保留在可控范围内。',
        role1: '系统',
        dialog1: '当前为 localhost 开源模式，可持续免费创作与管理项目。',
        role2: '创作者',
        dialog2: '很好，既能写得快，也不用担心数据外流。',
        action2: '右侧能力面板会同步提示部署状态、开源入口和本地可用能力。',
        float1Icon: 'lucide:shield-check',
        float1Text: '数据安全可控',
        float2Icon: 'lucide:server',
        float2Text: '支持本地部署',
      },
    }
  }

  return {
    badge: '商业版 · 在线创作 + 可私有部署',
    badgeIcon: 'lucide:sparkles',
    titleLine: '用知剧创作',
    titleHighlight: '你的下一部爆款短剧',
    desc: '在线即可免费体验核心创作流程，同时保留开源与本地部署能力。既能快速上手，也能兼顾团队对私有化与数据安全的要求。',
    primaryActionText: '开始创作',
    secondaryActionText: '了解更多',
    secondaryActionIcon: 'lucide:arrow-down',
    highlights: [
      { icon: 'lucide:gift', title: '永久免费', desc: '核心创作能力可直接体验' },
      { icon: 'lucide:folder-git-2', title: '开源地址', desc: 'Gitee / GitHub 均可访问' },
      { icon: 'lucide:server', title: '支持本地部署', desc: '可扩展到私有环境使用' },
      { icon: 'lucide:shield', title: '数据安全', desc: '兼顾在线效率与安全诉求' },
    ],
    resourceLinks: [
      { label: 'Gitee 开源', icon: 'lucide:folder-git-2', url: EXTERNAL_LINKS.gitee },
      { label: 'GitHub 开源', icon: 'lucide:github', url: EXTERNAL_LINKS.github },
    ],
    stats: [
      { value: 'Free', label: '永久免费体验' },
      { value: 'Open', label: '开源可二开' },
      { value: 'Deploy', label: '支持本地部署' },
    ],
    visual: {
      heading: '第一集 · 命运的转折',
      scene: '繁华都市CBD · 清晨 · 外景',
      action1: '林晓站在写字楼前，手中攥着一份被退回的剧本，眼神坚定。',
      role1: '林晓',
      dialog1: '这一次，我不会再让任何人看轻我的故事。',
      role2: '陈总监',
      dialog2: '你确定？这个行业不缺有梦想的人。',
      action2: '林晓微微一笑，将修改好的剧本放在桌上。',
      float1Icon: 'lucide:sparkles',
      float1Text: '永久免费体验',
      float2Icon: 'lucide:shield-check',
      float2Text: '支持本地部署',
    },
  }
})

const coreFeatures = [
  {
    icon: 'lucide:pen-line',
    title: '自己写剧本',
    desc: '输入你的创意灵感，智能生成完整的短剧剧本，从大纲到对白一气呵成。',
    highlights: ['智能分集大纲', '角色性格设计', '专业台词对白', '场景描写生成'],
    cta: '立即创作',
    path: '/write',
  },
  {
    icon: 'lucide:book-text',
    title: '小说转剧本',
    desc: '上传你的小说文本，自动分析章节结构，智能改编为短剧剧本格式。',
    highlights: ['章节智能分析', '情节精准提取', '对白自动改编', '保留原作精髓'],
    cta: '开始转化',
    path: '/novel-to-script',
  },
]

const aiCapabilities = [
  {
    icon: 'lucide:list-tree',
    title: '智能分集大纲',
    desc: '根据题材和设定，自动生成多集剧情大纲，每集起承转合完整。',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
  },
  {
    icon: 'lucide:users',
    title: '角色设计',
    desc: '智能生成角色性格、背景、关系图谱，让每个角色都鲜活立体。',
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
  },
  {
    icon: 'lucide:message-square-text',
    title: '台本生成',
    desc: '基于大纲自动生成专业台本，包含场景描写、动作指示、台词对白。',
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
  },
  {
    icon: 'lucide:clapperboard',
    title: '分镜脚本',
    desc: '将台本智能拆解为分镜头脚本，标注景别、机位、运镜方式。',
    color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
  },
  {
    icon: 'lucide:image',
    title: '封面生成',
    desc: '根据剧本内容智能生成封面图，支持多种风格选择。',
    color: 'linear-gradient(135deg, #fa709a, #fee140)',
  },
  {
    icon: 'lucide:file-down',
    title: 'Word 导出',
    desc: '一键导出标准格式的 Word 文档，直接用于制作团队沟通。',
    color: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  },
]

const workflowSteps = [
  {
    icon: 'lucide:lightbulb',
    title: '输入创意',
    desc: '描述你的故事灵感，选择题材类型和风格偏好',
  },
  {
    icon: 'lucide:bot',
    title: '智能生成',
    desc: '自动生成分集大纲、角色设定和完整剧本',
  },
  {
    icon: 'lucide:pencil',
    title: '编辑优化',
    desc: '在线编辑调整，对话式协作打磨细节',
  },
  {
    icon: 'lucide:download',
    title: '导出成品',
    desc: '导出 Word 文档或分镜脚本，交付制作团队',
  },
]

/**
 * 处理导航点击（需要登录的页面走登录拦截）
 */
const handleNavClick = (path) => {
  if (userStore.isLoggedIn) {
    navigateTo(path)
  } else {
    userStore.openLoginModal(path)
  }
}

const openExternal = (url) => {
  if (process.client) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

const handleSecondaryAction = () => {
  if (userStore.isLocalMode) {
    openExternal(EXTERNAL_LINKS.official)
    return
  }
  scrollToFeatures()
}

const scrollToFeatures = () => {
  if (process.client) {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<style scoped>
/* ========================================
 * 通用 Section Heading
 * ======================================== */
.section-heading {
  text-align: center;
  margin-bottom: 48px;
}

.section-heading__tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 16px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  border-radius: 20px;
  margin-bottom: 16px;
}

.section-heading__title {
  font-size: 28px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 12px;
  line-height: 1.3;
}

.section-heading__desc {
  font-size: 15px;
  color: var(--color-text-secondary);
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ========================================
 * Hero Banner
 * ======================================== */
.hero {
  display: flex;
  align-items: center;
  gap: 60px;
  padding: 48px 48px 56px;
  background: var(--color-bg-white);
  border-radius: 24px;
  margin-bottom: 40px;
  overflow: hidden;
  position: relative;
}

.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(255, 107, 53, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.hero__content {
  flex: 1;
  position: relative;
  z-index: 2;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(247, 65, 143, 0.1));
  border: 1px solid rgba(255, 107, 53, 0.15);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  margin-bottom: 24px;
}

.hero__title {
  font-size: 40px;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 20px;
}

.hero__title-line {
  display: block;
  color: var(--color-text);
}

.hero__title-highlight {
  display: block;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__desc {
  font-size: 16px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 24px;
  max-width: 480px;
}

.hero__highlight-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.hero__highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.hero__highlight-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero__highlight-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.hero__highlight-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.hero__highlight-desc {
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-text-secondary);
}

.hero__actions {
  display: flex;
  gap: 14px;
  margin-bottom: 18px;
}

.hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.25s;
  border: none;
}

.hero__btn--primary {
  background: var(--color-primary-gradient);
  color: #fff;
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3);
}

.hero__btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 107, 53, 0.4);
}

.hero__btn--secondary {
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.hero__btn--secondary:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.hero__resource-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 28px;
}

.hero__resource-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.hero__resource-link:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 107, 53, 0.35);
  color: var(--color-primary);
  box-shadow: 0 10px 20px rgba(255, 107, 53, 0.08);
}

.hero__resource-link--official {
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(247, 65, 143, 0.12));
  border-color: rgba(255, 107, 53, 0.2);
  color: var(--color-primary);
}

.hero__stats {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.hero__stat-group {
  display: flex;
  align-items: center;
  gap: 24px;
}

.hero__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero__stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text);
}

.hero__stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.hero__stat-divider {
  width: 1px;
  height: 32px;
  background: var(--color-border);
}

/* Hero 右侧视觉区域 - 模拟编辑器 */
.hero__visual {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 520px;
}

.hero__editor {
  position: relative;
  background: var(--color-bg-white);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.hero__editor-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fafbfc;
  border-bottom: 1px solid var(--color-border-light);
}

.hero__editor-dots {
  display: flex;
  gap: 6px;
}

.hero__editor-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.hero__editor-dots span:nth-child(1) { background: #ff5f57; }
.hero__editor-dots span:nth-child(2) { background: #febc2e; }
.hero__editor-dots span:nth-child(3) { background: #28c840; }

.hero__editor-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.hero__editor-body {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 240px;
}

.hero__editor-line {
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text);
  animation: line-fade-in 0.6s ease-out both;
}

.hero__editor-line:nth-child(1) { animation-delay: 0.2s; }
.hero__editor-line:nth-child(2) { animation-delay: 0.4s; }
.hero__editor-line:nth-child(3) { animation-delay: 0.6s; }
.hero__editor-line:nth-child(4) { animation-delay: 0.8s; }
.hero__editor-line:nth-child(5) { animation-delay: 1.0s; }
.hero__editor-line:nth-child(6) { animation-delay: 1.2s; }

.hero__editor-line--heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--color-border-light);
}

.hero__editor-line--scene {
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero__editor-tag {
  display: inline-block;
  padding: 1px 8px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-info);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  flex-shrink: 0;
}

.hero__editor-line--action {
  color: var(--color-text-secondary);
  font-style: italic;
  padding-left: 12px;
  border-left: 2px solid var(--color-border-light);
}

.hero__editor-line--dialog {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.hero__editor-role {
  display: inline-block;
  padding: 1px 8px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.hero__editor-cursor {
  width: 2px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 1px;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes line-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero__editor-float {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-bg-white);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border-light);
  font-size: 12px;
  font-weight: 600;
  z-index: 3;
}

.hero__editor-float--1 {
  bottom: 60px;
  right: -20px;
  color: var(--color-primary);
  animation: float-tag 3s ease-in-out infinite;
}

.hero__editor-float--2 {
  top: 50px;
  right: -16px;
  color: var(--color-success);
  animation: float-tag 3.5s ease-in-out 0.5s infinite;
}

@keyframes float-tag {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* ========================================
 * 核心功能卡片
 * ======================================== */
.features {
  margin-bottom: 40px;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.feature-card {
  background: var(--color-bg-white);
  border-radius: 20px;
  padding: 32px 28px 24px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 20px 20px 0 0;
  opacity: 0;
  transition: opacity 0.3s;
}

.feature-card--1::before { background: linear-gradient(90deg, #ff6b35, #f7418f); }
.feature-card--2::before { background: linear-gradient(90deg, #667eea, #764ba2); }
.feature-card--3::before { background: linear-gradient(90deg, #43e97b, #38f9d7); }

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  border-color: var(--color-border);
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-card__icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: #fff;
}

.feature-card__icon-wrap--1 { background: linear-gradient(135deg, #ff6b35, #f7418f); }
.feature-card__icon-wrap--2 { background: linear-gradient(135deg, #667eea, #764ba2); }
.feature-card__icon-wrap--3 { background: linear-gradient(135deg, #43e97b, #38f9d7); }

.feature-card__body {
  flex: 1;
}

.feature-card__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 10px;
}

.feature-card__desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 18px;
}

.feature-card__highlights {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 20px;
}

.feature-card__highlights li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text);
}

.feature-card__check {
  color: var(--color-success);
  flex-shrink: 0;
}

.feature-card__cta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
  transition: gap 0.2s;
}

.feature-card:hover .feature-card__cta {
  gap: 10px;
}

/* ========================================
 * 平台能力展示
 * ======================================== */
.capabilities {
  margin-bottom: 40px;
}

.capabilities__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.cap-card {
  background: var(--color-bg-white);
  border-radius: 16px;
  padding: 28px 24px;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.cap-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
  border-color: var(--color-border);
}

.cap-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.cap-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.cap-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* ========================================
 * 创作流程
 * ======================================== */
.workflow {
  margin-bottom: 40px;
}

.workflow__steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  position: relative;
}

.step-card {
  background: var(--color-bg-white);
  border-radius: 16px;
  padding: 28px 24px;
  text-align: center;
  position: relative;
  transition: all 0.3s;
}

.step-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
}

.step-card__number {
  font-size: 36px;
  font-weight: 800;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0.2;
  position: absolute;
  top: 12px;
  right: 18px;
  line-height: 1;
}

.step-card__icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.step-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.step-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.step-card__arrow {
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  background: var(--color-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
  z-index: 2;
  border: 2px solid var(--color-border-light);
}

/* ========================================
 * 底部 CTA
 * ======================================== */
.bottom-cta {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  margin-bottom: 20px;
}

.bottom-cta__bg {
  position: absolute;
  inset: 0;
  background: var(--color-primary-gradient);
  opacity: 0.95;
}

.bottom-cta__content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 56px 40px;
}

.bottom-cta__title {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 12px;
}

.bottom-cta__desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 28px;
}

.bottom-cta__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 36px;
  background: #fff;
  color: var(--color-primary);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  transition: all 0.25s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.bottom-cta__btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* ========================================
 * 响应式
 * ======================================== */
@media (max-width: 1200px) {
  .hero {
    flex-direction: column;
    text-align: center;
    gap: 40px;
    padding: 40px 32px;
  }

  .hero__desc {
    max-width: 100%;
  }

  .hero__actions {
    justify-content: center;
  }

  .hero__resource-links {
    justify-content: center;
  }

  .hero__stats {
    justify-content: center;
  }

  .hero__visual {
    max-width: 100%;
  }

  .hero__editor-float {
    display: none;
  }

  .features__grid {
    grid-template-columns: 1fr;
    max-width: 520px;
    margin: 0 auto;
  }

  .capabilities__grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .workflow__steps {
    grid-template-columns: repeat(2, 1fr);
  }

  .step-card__arrow {
    display: none;
  }
}

@media (max-width: 768px) {
  .hero__title {
    font-size: 28px;
  }

  .hero__highlight-list {
    grid-template-columns: 1fr;
  }

  .hero__actions {
    flex-direction: column;
  }

  .hero__btn {
    justify-content: center;
    width: 100%;
  }

  .hero__visual {
    display: none;
  }

  .section-heading__title {
    font-size: 22px;
  }

  .capabilities__grid {
    grid-template-columns: 1fr;
  }

  .workflow__steps {
    grid-template-columns: 1fr;
  }

  .bottom-cta__content {
    padding: 40px 24px;
  }

  .bottom-cta__title {
    font-size: 22px;
  }
}
</style>
