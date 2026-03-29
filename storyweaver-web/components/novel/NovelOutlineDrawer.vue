<template>
  <Teleport to="body">
    <Transition name="od-drawer">
      <div v-if="visible && episode" class="od-overlay" @click.self="$emit('close')">
        <div class="od-drawer">
          <!-- 抽屉头部 -->
          <div class="od-drawer__header">
            <div class="od-drawer__header-left">
              <span class="od-drawer__ep-num">第{{ episodeIndex + 1 }}集</span>
              <span class="od-drawer__ep-title">{{ episode.title || '未命名' }}</span>
              <span v-if="episode.chapterRange && episode.chapterRange.length" class="od-drawer__chapter-range">
                章节 {{ episode.chapterRange[0] }}-{{ episode.chapterRange[episode.chapterRange.length - 1] }}
              </span>
            </div>
            <button class="od-drawer__close-btn" @click="$emit('close')">
              <Icon name="lucide:x" size="18" />
            </button>
          </div>

          <!-- 抽屉内容（可滚动） -->
          <div class="od-drawer__body">
            <!-- 大纲正文 -->
            <section v-if="episode.content" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:file-text" size="15" />
                <span>大纲内容</span>
              </div>
              <div class="od-section__text od-section__text--content">{{ episode.content }}</div>
            </section>

            <!-- 核心冲突 -->
            <section v-if="detail.coreConflict" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:swords" size="15" />
                <span>核心冲突</span>
              </div>
              <div class="od-section__text">{{ detail.coreConflict }}</div>
            </section>

            <!-- 开场钩子 -->
            <section v-if="detail.openingHook" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:flag" size="15" />
                <span>开场钩子</span>
              </div>
              <div class="od-section__text">{{ detail.openingHook }}</div>
            </section>

            <!-- 关键事件 -->
            <section v-if="detail.keyEvents && detail.keyEvents.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:list-ordered" size="15" />
                <span>关键事件</span>
              </div>
              <div class="od-section__events">
                <div v-for="(evt, ei) in detail.keyEvents" :key="ei" class="od-event">
                  <span class="od-event__num">{{ ei + 1 }}</span>
                  <span class="od-event__text">{{ typeof evt === 'string' ? evt : evt.description || evt.title || JSON.stringify(evt) }}</span>
                </div>
              </div>
            </section>

            <!-- 情感曲线 -->
            <section v-if="detail.emotionalCurve" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:activity" size="15" />
                <span>情感曲线</span>
              </div>
              <div class="od-section__text">{{ detail.emotionalCurve }}</div>
            </section>

            <!-- 视觉亮点 -->
            <section v-if="detail.visualHighlights && detail.visualHighlights.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:eye" size="15" />
                <span>视觉亮点</span>
              </div>
              <div class="od-section__tags">
                <span v-for="(vh, vi) in detail.visualHighlights" :key="vi" class="od-tag od-tag--visual">{{ vh }}</span>
              </div>
            </section>

            <!-- 经典台词 -->
            <section v-if="detail.classicQuotes && detail.classicQuotes.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:message-circle" size="15" />
                <span>经典台词</span>
              </div>
              <div class="od-section__quotes">
                <div v-for="(q, qi) in detail.classicQuotes" :key="qi" class="od-quote">"{{ q }}"</div>
              </div>
            </section>

            <!-- 结尾钩子 -->
            <section v-if="detail.endingHook" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:anchor" size="15" />
                <span>结尾钩子</span>
              </div>
              <div class="od-section__text">{{ detail.endingHook }}</div>
            </section>

            <!-- 出场角色 -->
            <section v-if="detail.characters && detail.characters.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:users" size="15" />
                <span>出场角色</span>
                <span class="od-section__count">{{ detail.characters.length }}人</span>
              </div>

              <!-- 模式一：有创作资产角色 → 用资产卡片样式展示（按名字配对） -->
              <div v-if="hasAssetCharacters" class="od-char-grid">
                <div
                  v-for="(ch, ci) in mergedCharacters"
                  :key="ci"
                  class="od-char-card"
                  :class="`od-char-card--${ch.roleType || 'other'}`"
                >
                  <div class="od-char-card__top">
                    <span class="od-char-card__badge">{{ ROLE_LABELS[ch.roleType] || '角色' }}</span>
                    <span class="od-char-card__name">{{ ch.name }}</span>
                    <span v-if="ch.gender || ch.age" class="od-char-card__meta">{{ [ch.gender, ch.age].filter(Boolean).join(' · ') }}</span>
                  </div>
                  <p class="od-char-card__desc">
                    {{ ch.background || ch.relationship || ch.description || ch.intro || ch.role || '暂无描述' }}
                  </p>
                </div>
              </div>

              <!-- 模式二：无创作资产角色 → 用大纲原始数据简单展示 -->
              <div v-else class="od-char-grid">
                <div
                  v-for="(ch, ci) in detail.characters"
                  :key="ci"
                  class="od-char-card"
                  :class="`od-char-card--${guessRoleType(ch)}`"
                >
                  <div class="od-char-card__top">
                    <span class="od-char-card__badge">{{ guessRoleLabel(ch) }}</span>
                    <span class="od-char-card__name">{{ ch.name }}</span>
                  </div>
                  <p v-if="ch.description || ch.intro || ch.role" class="od-char-card__desc">
                    {{ ch.description || ch.intro || ch.role }}
                  </p>
                </div>
              </div>
            </section>

            <!-- 场景 -->
            <section v-if="detail.scenes && detail.scenes.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:map-pin" size="15" />
                <span>场景</span>
                <span class="od-section__count">{{ detail.scenes.length }}个</span>
              </div>
              <div class="od-card-list">
                <div v-for="(sc, si) in detail.scenes" :key="si" class="od-item-card od-item-card--scene">
                  <span class="od-item-card__name">{{ sc.name }}</span>
                  <span v-if="sc.description || sc.intro" class="od-item-card__desc">{{ sc.description || sc.intro }}</span>
                </div>
              </div>
            </section>

            <!-- 关键道具 -->
            <section v-if="detail.props && detail.props.length" class="od-section">
              <div class="od-section__header">
                <Icon name="lucide:gem" size="15" />
                <span>关键道具</span>
                <span class="od-section__count">{{ detail.props.length }}件</span>
              </div>
              <div class="od-card-list">
                <div v-for="(pr, pi) in detail.props" :key="pi" class="od-item-card od-item-card--prop">
                  <span class="od-item-card__name">{{ pr.name }}</span>
                  <span v-if="pr.description || pr.intro" class="od-item-card__desc">{{ pr.description || pr.intro }}</span>
                </div>
              </div>
            </section>

            <!-- 无详情数据时 -->
            <div v-if="!hasAnyDetail && !episode.content" class="od-empty">
              <Icon name="lucide:sparkles" size="24" />
              <p>暂无结构化详情数据</p>
              <p class="od-empty__hint">通过右侧创作助手与AI对话，生成本集大纲</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 大纲详情抽屉 - 从右侧滑出展示单集大纲的完整结构化信息
 * 复用角色卡片抽屉的交互模式（Teleport + Transition）
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  episode: { type: Object, default: null },
  episodeIndex: { type: Number, default: 0 },
  /** 创作资产中的角色卡片数组，用于与大纲角色按名字配对 */
  characterCards: { type: Array, default: () => [] },
})

defineEmits(['close'])

const detail = computed(() => props.episode?.outlineDetail || {})

const hasAnyDetail = computed(() => {
  const d = detail.value
  return !!(
    d.coreConflict || d.openingHook || d.endingHook || d.emotionalCurve ||
    (d.keyEvents && d.keyEvents.length) ||
    (d.visualHighlights && d.visualHighlights.length) ||
    (d.classicQuotes && d.classicQuotes.length) ||
    (d.characters && d.characters.length) ||
    (d.scenes && d.scenes.length) ||
    (d.props && d.props.length)
  )
})

/** 创作资产中是否有角色数据 */
const hasAssetCharacters = computed(() => props.characterCards && props.characterCards.length > 0)

/**
 * 将大纲角色与创作资产角色按名字配对
 * 匹配到资产角色时使用资产数据（roleType/gender/age/background 等），否则回退到大纲原始数据
 */
const mergedCharacters = computed(() => {
  if (!detail.value.characters) return []
  const assetMap = new Map()
  for (const card of props.characterCards) {
    if (card.name) assetMap.set(card.name.trim(), card)
  }
  return detail.value.characters.map(ch => {
    const name = (ch.name || '').trim()
    const asset = assetMap.get(name)
    if (asset) {
      return {
        name,
        roleType: asset.roleType || 'other',
        gender: asset.gender || '',
        age: asset.age || '',
        background: asset.background || '',
        relationship: asset.relationship || '',
        description: ch.description || ch.intro || ch.role || '',
      }
    }
    return {
      name,
      roleType: guessRoleType(ch),
      gender: '',
      age: '',
      background: '',
      relationship: '',
      description: ch.description || ch.intro || ch.role || '',
    }
  })
})

const ROLE_KEYWORDS = {
  protagonist: ['主角', '男主', '女主', '主人公'],
  antagonist: ['反派', '大反派', '坏人', '敌人', 'boss'],
  ally: ['盟友', '朋友', '伙伴', '同伴', '兄弟'],
  lover: ['恋人', '爱人', '情人', '女友', '男友', '妻子', '丈夫'],
  rival: ['对手', '竞争者', '劲敌'],
}

const guessRoleType = (ch) => {
  const text = `${ch.role || ''} ${ch.description || ''} ${ch.intro || ''}`.toLowerCase()
  for (const [type, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

const ROLE_LABELS = {
  protagonist: '主角', antagonist: '反派', ally: '盟友',
  lover: '恋人', rival: '对手', other: '角色',
}

const guessRoleLabel = (ch) => ROLE_LABELS[guessRoleType(ch)] || '角色'
</script>

<style scoped>
/* ===== 遮罩层 ===== */
.od-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}

/* ===== 抽屉容器 ===== */
.od-drawer {
  width: 640px;
  max-width: 92vw;
  height: 100%;
  background: var(--color-bg-white, #fff);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== 头部 ===== */
.od-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 2px solid var(--color-primary, #ff6b35);
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.04), transparent);
}

.od-drawer__header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.od-drawer__ep-num {
  padding: 3px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  background: var(--color-primary, #ff6b35);
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

.od-drawer__ep-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.od-drawer__chapter-range {
  font-size: 11px;
  color: var(--color-text-light);
  background: var(--color-bg);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.od-drawer__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.od-drawer__close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* ===== 内容区 ===== */
.od-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 通用模块 ===== */
.od-section {
  padding: 16px;
  background: var(--color-bg);
  border-radius: 10px;
  border: 1px solid var(--color-border-light);
}

.od-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary, #ff6b35);
  margin-bottom: 10px;
}

.od-section__count {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-light);
  background: var(--color-bg-white);
  padding: 1px 8px;
  border-radius: 10px;
  margin-left: auto;
}

.od-section__text {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.8;
  padding: 10px 12px;
  background: var(--color-bg-white);
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
}

.od-section__text--content {
  white-space: pre-wrap;
}

/* ===== 关键事件 ===== */
.od-section__events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.od-event {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.7;
  padding: 10px 12px;
  background: var(--color-bg-white);
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
}

.od-event__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary, #ff6b35);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.od-event__text {
  flex: 1;
  min-width: 0;
}

/* ===== 标签 ===== */
.od-section__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.od-tag {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 14px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
}

.od-tag--visual {
  background: #e8f5e9;
  color: #2e7d32;
  border-color: #c8e6c9;
}

/* ===== 经典台词 ===== */
.od-section__quotes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.od-quote {
  font-size: 13px;
  color: #d84315;
  padding: 10px 14px;
  background: #fff3e0;
  border-radius: 8px;
  border-left: 3px solid #ff9800;
  font-style: italic;
  line-height: 1.7;
}

/* ===== 角色卡片网格（参考 NovelCharacterCards 样式） ===== */
.od-char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.od-char-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px 10px 15px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-white);
  overflow: hidden;
  transition: all 0.2s;
}

.od-char-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: #94a3b8;
}

.od-char-card--protagonist::before { background: #6366f1; }
.od-char-card--antagonist::before { background: #ef4444; }
.od-char-card--ally::before { background: #22c55e; }
.od-char-card--lover::before { background: #ec4899; }
.od-char-card--rival::before { background: #f59e0b; }

.od-char-card:hover {
  border-color: var(--color-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.od-char-card__top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.od-char-card__badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: #fff;
  background: #94a3b8;
  flex-shrink: 0;
}

.od-char-card--protagonist .od-char-card__badge { background: #6366f1; }
.od-char-card--antagonist .od-char-card__badge { background: #ef4444; }
.od-char-card--ally .od-char-card__badge { background: #22c55e; }
.od-char-card--lover .od-char-card__badge { background: #ec4899; }
.od-char-card--rival .od-char-card__badge { background: #f59e0b; }

.od-char-card__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.od-char-card__meta {
  font-size: 11px;
  color: var(--color-text-light);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.od-char-card__desc {
  font-size: 12px;
  line-height: 18px;
  height: 36px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin: 0;
}

/* ===== 场景/道具卡片 ===== */
.od-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.od-item-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-white);
  min-width: 140px;
  max-width: 260px;
  flex: 1;
}

.od-item-card--scene {
  border-left: 3px solid #66bb6a;
}

.od-item-card--prop {
  border-left: 3px solid #ab47bc;
}

.od-item-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.od-item-card__desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* ===== 空状态 ===== */
.od-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--color-text-light);
  text-align: center;
}

.od-empty p {
  margin: 0;
  font-size: 14px;
}

.od-empty__hint {
  font-size: 12px !important;
  color: var(--color-text-light);
}

/* ===== 抽屉进出动画 ===== */
.od-drawer-enter-active {
  transition: opacity 0.25s ease;
}
.od-drawer-enter-active .od-drawer {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.od-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.od-drawer-leave-active .od-drawer {
  transition: transform 0.2s ease-in;
}
.od-drawer-enter-from {
  opacity: 0;
}
.od-drawer-enter-from .od-drawer {
  transform: translateX(100%);
}
.od-drawer-leave-to {
  opacity: 0;
}
.od-drawer-leave-to .od-drawer {
  transform: translateX(100%);
}
</style>
