<template>
  <div class="script-content" ref="contentRef">
    <!-- 剧本标题 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'title' }"
      data-field="title"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:file-text" size="16" /></span>
        <h3 class="script-content__section-title">剧本标题</h3>
        <button
          class="script-content__lock-btn"
          :class="lockBtnClass('title', scriptData.title)"
          :disabled="!scriptData.title"
          @click="toggleLock('title')"
        >
          {{ lockBtnText('title', scriptData.title) }}
        </button>
      </div>
      <input
        v-model="scriptData.title"
        class="script-content__title-input"
        placeholder="输入剧本标题..."
      />
    </div>

    <!-- 基本信息 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'basicInfo' }"
      data-field="basicInfo"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:clipboard-list" size="16" /></span>
        <h3 class="script-content__section-title">基本信息</h3>
        <button
          class="script-content__lock-btn"
          :class="lockBtnClass('basicInfo', scriptData.basicInfo)"
          :disabled="!scriptData.basicInfo"
          @click="toggleLock('basicInfo')"
        >
          {{ lockBtnText('basicInfo', scriptData.basicInfo) }}
        </button>
      </div>
      <div class="script-content__block">
        <textarea
          v-model="scriptData.basicInfo"
          class="script-content__textarea"
          placeholder="剧本基本信息将由AI生成，包括题材、受众、集数等..."
          rows="4"
        ></textarea>
      </div>
    </div>

    <!-- 剧情梗概 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'synopsis' }"
      data-field="synopsis"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:book-open" size="16" /></span>
        <h3 class="script-content__section-title">剧情梗概</h3>
        <button
          class="script-content__lock-btn"
          :class="lockBtnClass('synopsis', scriptData.synopsis)"
          :disabled="!scriptData.synopsis"
          @click="toggleLock('synopsis')"
        >
          {{ lockBtnText('synopsis', scriptData.synopsis) }}
        </button>
      </div>
      <div class="script-content__block">
        <textarea
          v-model="scriptData.synopsis"
          class="script-content__textarea"
          placeholder="整体剧情梗概将由AI生成..."
          rows="6"
        ></textarea>
      </div>
    </div>
    <!-- 创作资产：人物介绍 / 角色 / 场景 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'characters' }"
      data-field="characters"
    >
      <div class="script-content__section-header script-content__section-header--assets">
        <span class="script-content__section-icon"><Icon name="lucide:users" size="16" /></span>
        <div class="script-content__tabs">
          <button
            v-for="tab in assetTabs"
            :key="tab.key"
            class="script-content__tab"
            :class="{ 'script-content__tab--active': activeAssetTab === tab.key }"
            @click="activeAssetTab = tab.key"
          >
            <Icon :name="tab.icon" size="14" /> {{ tab.label }}
          </button>
        </div>
        <div class="script-content__tab-actions">
          <button
            v-if="activeAssetTab === 'intro'"
            class="script-content__lock-btn"
            :class="lockBtnClass('characters', scriptData.characters)"
            :disabled="!scriptData.characters"
            @click="toggleLock('characters')"
          >
            {{ lockBtnText('characters', scriptData.characters) }}
          </button>
          <template v-else-if="activeAssetTab === 'character'">
            <button
              class="script-content__action-btn"
              :disabled="!scriptData.characters?.trim()"
              @click="characterCardsRef?.triggerParse?.()"
            >
              从文本解析
            </button>
            <button
              class="script-content__action-btn script-content__action-btn--primary"
              @click="characterCardsRef?.addCharacter?.()"
            >
              添加
            </button>
          </template>
          <template v-else-if="activeAssetTab === 'scene'">
            <button
              class="script-content__action-btn"
              :disabled="sceneExtracting || !scriptId"
              @click="handleExtractScenes"
            >
              <template v-if="sceneExtracting">
                <Icon name="lucide:loader-2" size="14" class="script-content__action-spin" />
                获取中（{{ sceneExtractProgressText }}）
              </template>
              <template v-else>
                <Icon name="lucide:refresh-cw" size="14" />
                点击场景获取
              </template>
            </button>
            <button
              class="script-content__action-btn script-content__action-btn--primary"
              @click="sceneCardsRef?.addScene?.()"
            >
              添加
            </button>
          </template>
        </div>
      </div>
      <div v-show="activeAssetTab === 'intro'" class="script-content__block">
        <textarea
          v-model="scriptData.characters"
          class="script-content__textarea"
          placeholder="主要角色设定将由AI生成，包括姓名、性格、背景..."
          rows="8"
        ></textarea>
      </div>
      <div v-show="activeAssetTab === 'character'" class="script-content__asset-panel">
        <WriteCharacterCards
          ref="characterCardsRef"
          v-model="characterCards"
          :characters-text="scriptData.characters"
          :script-id="scriptId"
          :api-base="apiBase"
          :show-header="false"
          @parse="emit('parse-characters')"
          @save="(data) => emit('save-characters', data)"
        />
      </div>
      <div v-show="activeAssetTab === 'scene'" class="script-content__asset-panel">
        <WriteSceneCards
          ref="sceneCardsRef"
          v-model="sceneCards"
          :script-id="scriptId"
          :api-base="apiBase"
          :empty-text="sceneExtracting ? '正在从大纲提取场景，请稍候...' : '暂无场景数据，可点击「点击场景获取」从大纲中自动抽离，或手动添加。'"
          @save="handleSaveScenes"
        />
      </div>
    </div>

    <!-- 信息流情绪点 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'emotionPoints' }"
      data-field="emotionPoints"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:flame" size="16" /></span>
        <h3 class="script-content__section-title">信息流情绪点</h3>
        <button
          class="script-content__lock-btn"
          :class="lockBtnClass('emotionPoints', scriptData.emotionPoints)"
          :disabled="!scriptData.emotionPoints"
          @click="toggleLock('emotionPoints')"
        >
          {{ lockBtnText('emotionPoints', scriptData.emotionPoints) }}
        </button>
      </div>
      <div class="script-content__block">
        <textarea
          v-model="scriptData.emotionPoints"
          class="script-content__textarea"
          placeholder="核心冲突点、情感背叛、阶级反差、极端行为等情绪引爆要素将由AI生成..."
          rows="6"
        ></textarea>
      </div>
    </div>

    <!-- 剧情线 -->
    <div
      class="script-content__section"
      :class="{ 'script-content__section--ai-filling': aiFillingField === 'plotLines' }"
      data-field="plotLines"
    >
      <div class="script-content__section-header">
        <span class="script-content__section-icon"><Icon name="lucide:link" size="16" /></span>
        <h3 class="script-content__section-title">剧情线</h3>
        <button
          class="script-content__lock-btn"
          :class="lockBtnClass('plotLines', scriptData.plotLines)"
          :disabled="!scriptData.plotLines"
          @click="toggleLock('plotLines')"
        >
          {{ lockBtnText('plotLines', scriptData.plotLines) }}
        </button>
      </div>
      <div class="script-content__block">
        <textarea
          v-model="scriptData.plotLines"
          class="script-content__textarea"
          placeholder="主线/支线剧情将由AI生成..."
          rows="6"
        ></textarea>
      </div>
    </div>

    <!-- 分集内容区（大纲 / 剧本 / 分镜 Tab切换） -->
    <div
      class="script-content__section script-content__section--episodes"
      :class="{ 'script-content__section--ai-filling': aiFillingField.startsWith('episode') }"
      data-field="episodes"
    >
      <div class="script-content__section-header script-content__section-header--sticky">
        <span class="script-content__section-icon"><Icon name="lucide:clapperboard" size="16" /></span>
        <!-- Tab切换 -->
        <div class="script-content__tabs">
          <button
            v-for="tab in episodeTabs"
            :key="tab.key"
            class="script-content__tab"
            :class="{ 'script-content__tab--active': activeEpisodeTab === tab.key }"
            @click="activeEpisodeTab = tab.key"
          >
            <Icon :name="tab.icon" size="14" /> {{ tab.label }}
          </button>
        </div>

        <!-- Tab右侧功能区 -->
        <div class="script-content__tab-actions">
          <!-- 大纲Tab：提示文字 -->
          <span v-if="activeEpisodeTab === 'outline'" class="script-content__tab-hint">通过创作助手来创作大纲 →</span>

          <!-- 剧本Tab：批量生成下拉 / 批量生成中显示进度+停止 -->
          <template v-if="activeEpisodeTab === 'script'">
            <!-- 批量生成中：显示进度和停止按钮 -->
            <div v-if="isBatchGenerating" class="script-content__batch-status">
              <span class="script-content__batch-progress">正在生成 {{ batchProgress.current }}/{{ batchProgress.total }}</span>
              <button class="script-content__action-btn script-content__action-btn--danger" @click="emit('stop-batch-generate')">停止生成</button>
            </div>
            <!-- 非批量生成中：显示下拉菜单 -->
            <div v-else class="script-content__batch-dropdown" @mouseenter="scriptDropdownVisible = true" @mouseleave="scriptDropdownVisible = false">
              <button class="script-content__action-btn script-content__action-btn--primary">批量生成</button>
              <div v-show="scriptDropdownVisible" class="script-content__batch-menu">
                <button class="script-content__batch-menu-item" @click="emit('batch-script-continue')">继续生成</button>
                <button class="script-content__batch-menu-item script-content__batch-menu-item--danger" @click="emit('batch-script-clear')">批量清空</button>
                <button class="script-content__batch-menu-item" @click="emit('batch-script-regenerate')">重新生成</button>
              </div>
            </div>
          </template>

          <!-- 全部锁定/解锁按钮（分镜tab下隐藏） -->
          <button v-show="activeEpisodeTab === 'outline'" class="script-content__batch-lock-btn" @click="emit('batch-lock', activeEpisodeTab)">全部锁定</button>
          <button v-show="activeEpisodeTab === 'outline'" class="script-content__batch-lock-btn" @click="emit('batch-unlock', activeEpisodeTab)">全部解锁</button>
        </div>

        <span class="script-content__section-badge">{{ scriptData.episodes.length }}集</span>
      </div>

      <!-- ===== 大纲Tab（现有功能） ===== -->
      <div v-show="activeEpisodeTab === 'outline'" class="script-content__episodes">
        <div
          v-for="(ep, index) in scriptData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{ 'script-content__episode--ai-filling': aiFillingField === `episode_${index + 1}` }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <input
              v-model="ep.title"
              class="script-content__episode-title-input"
              :placeholder="`第${index + 1}集标题...`"
            />
            <!-- 剧集锁定按钮：仅有内容时展示 -->
            <button
              v-if="ep.title || ep.content"
              class="script-content__lock-btn script-content__lock-btn--episode"
              :class="episodeLockBtnClass(index)"
              @click="toggleEpisodeLock(index)"
            >
              {{ episodeLockBtnText(index) }}
            </button>
          </div>
          <textarea
            v-model="ep.content"
            class="script-content__textarea script-content__textarea--episode"
            :placeholder="`第${index + 1}集剧情大纲...`"
            rows="4"
          ></textarea>
        </div>

        <!-- 添加更多集 -->
        <button class="script-content__add-episode" @click="addEpisode">
          <span>+</span> 添加一集
        </button>
      </div>

      <!-- ===== 剧本Tab ===== -->
      <div v-show="activeEpisodeTab === 'script'" class="script-content__episodes">
        <div
          v-for="(ep, index) in scriptData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{ 'script-content__episode--generating': generatingEpisodeIndex === index }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <span class="script-content__episode-title-text">{{ ep.title || '未命名' }}</span>
            <!-- 生成中时显示停止按钮 -->
            <button
              v-if="generatingEpisodeIndex === index"
              class="script-content__action-btn script-content__action-btn--sm"
              @click="emit('stop-generate-script', index)"
            >
              停止
            </button>
            <!-- 非生成中时显示生成按钮 -->
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--primary script-content__action-btn--sm"
              :disabled="isGenerateBtnDisabled(ep, index)"
              @click="emit('generate-episode-script', index)"
            >
              {{ generateBtnText(ep, index) }}
            </button>
            <!-- 台本锁定按钮：有内容且非生成中时展示 -->
          </div>
          <!-- 有剧本内容时展示textarea -->
          <textarea
            v-if="ep.scriptContent"
            v-model="ep.scriptContent"
            class="script-content__textarea script-content__textarea--episode script-content__textarea--script"
            placeholder="剧本内容..."
            rows="8"
            @input="emit('save-script-content', index)"
          ></textarea>
          <!-- 生成中时展示加载提示 -->
          <div v-else-if="generatingEpisodeIndex === index" class="script-content__episode-generating">
            正在生成剧本，请稍候...
          </div>
          <!-- 无内容时展示简洁提示 -->
          <div v-else class="script-content__episode-empty">
            {{ ep.scriptStatus === 3 ? '台本生成失败，请点击"重试生成"' : '剧本未生成 — 请先确认大纲，点击"生成剧本"扩写为场景/对白/动作' }}
          </div>
        </div>
      </div>

      <!-- ===== 分镜Tab ===== -->
      <div v-show="activeEpisodeTab === 'storyboard'" class="script-content__episodes">
        <!-- 分镜全局设置栏 -->
        <div class="script-content__storyboard-settings">
          <div class="script-content__setting-item">
            <label class="script-content__setting-label">画风风格</label>
            <select v-model="storyboardStyle" class="script-content__setting-select">
              <option v-for="s in styleOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="script-content__setting-item">
            <label class="script-content__setting-label">画面比例</label>
            <select v-model="storyboardAspectRatio" class="script-content__setting-select">
              <option value="16:9">16:9 横屏</option>
              <option value="9:16">9:16 竖屏</option>
              <option value="1:1">1:1 方形</option>
            </select>
          </div>
        </div>

        <div
          v-for="(ep, index) in scriptData.episodes"
          :key="index"
          class="script-content__episode"
          :class="{
            'script-content__episode--generating': generatingStoryboardIndex === index || generatingVideoStoryboardIndex === index
          }"
        >
          <div class="script-content__episode-header">
            <span class="script-content__episode-num">第{{ index + 1 }}集</span>
            <span class="script-content__episode-title-text">{{ ep.title || '未命名' }}</span>
            <!-- 图片分镜状态标签 -->
            <span v-if="ep.storyboardStatus === 2" class="script-content__storyboard-badge script-content__storyboard-badge--done">
              {{ ep.storyboardTotalShots || 0 }}个首帧镜头
            </span>
            <!-- 视频分镜状态标签：首帧分镜存在时始终展示 -->
            <span
              v-if="ep.storyboardStatus === 2"
              class="script-content__storyboard-badge"
              :class="{
                'script-content__storyboard-badge--video': ep.videoStoryboardData?.shots?.length > 0,
                'script-content__storyboard-badge--video-empty': !ep.videoStoryboardData?.shots?.length,
                'script-content__storyboard-badge--video-generating': generatingVideoStoryboardIndex === index,
              }"
            >
              <template v-if="generatingVideoStoryboardIndex === index">
                视频生成中 {{ ep.videoStoryboardData?.shots?.length || 0 }}/{{ ep.storyboardTotalShots || 0 }}
              </template>
              <template v-else>
                {{ ep.videoStoryboardData?.shots?.length || 0 }}个视频镜头
              </template>
            </span>
            <!-- 图片分镜：生成中显示停止 -->
            <button
              v-if="generatingStoryboardIndex === index"
              class="script-content__action-btn script-content__action-btn--danger script-content__action-btn--sm"
              @click="emit('stop-generate-storyboard', index)"
            >
              停止生成首帧
            </button>
            <!-- 图片分镜：非生成中显示生成按钮 -->
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--primary script-content__action-btn--sm"
              :disabled="isStoryboardBtnDisabled(ep, index)"
              @click="emit('generate-storyboard', { index })"
            >
              {{ storyboardBtnText(ep, index) }}
            </button>
            <!-- 视频分镜：生成中显示停止 -->
            <button
              v-if="generatingVideoStoryboardIndex === index"
              class="script-content__action-btn script-content__action-btn--danger script-content__action-btn--sm"
              @click="emit('stop-generate-video-storyboard', index)"
            >
              停止生成视频
            </button>
            <!-- 视频分镜：非生成中显示生成按钮 -->
            <button
              v-else
              class="script-content__action-btn script-content__action-btn--video script-content__action-btn--sm"
              :disabled="isVideoStoryboardBtnDisabled(ep, index)"
              @click="emit('generate-video-storyboard', { index })"
            >
              {{ videoStoryboardBtnText(ep, index) }}
            </button>
          </div>

          <!-- 有分镜数据时展示镜头卡片 -->
          <div v-if="ep.storyboardData && ep.storyboardData.scenes" class="script-content__storyboard-scenes">
            <div
              v-for="(scene, sIdx) in ep.storyboardData.scenes"
              :key="sIdx"
              class="script-content__scene-block"
            >
              <div class="script-content__scene-header">
                <span class="script-content__scene-num">场景{{ scene.scene_number }}</span>
                <span class="script-content__scene-name">{{ scene.scene_name }}</span>
                <span class="script-content__scene-meta">{{ scene.scene_time }} / {{ scene.scene_location }}</span>
                <span class="script-content__scene-mood">{{ scene.scene_mood }}</span>
              </div>
              <div class="script-content__shot-list">
                <div
                  v-for="(shot, shotIdx) in scene.shots"
                  :key="shotIdx"
                  class="script-content__shot-card"
                  :class="{ 'script-content__shot-card--video-mode': getShotViewMode(index, sIdx, shotIdx) === 'video' }"
                >
                  <!-- 镜头头部：序号 + 图片/视频toggle + 信息标签 -->
                  <div class="script-content__shot-header">
                    <span class="script-content__shot-num">镜头{{ shot.shot_number }}</span>
                    <!-- 图片/视频 toggle -->
                    <div class="script-content__shot-toggle">
                      <button
                        class="script-content__shot-toggle-btn"
                        :class="{ 'script-content__shot-toggle-btn--active': getShotViewMode(index, sIdx, shotIdx) === 'image' }"
                        @click="toggleShotViewMode(index, sIdx, shotIdx, 'image')"
                      ><Icon name="lucide:camera" size="14" /> 图片</button>
                      <button
                        class="script-content__shot-toggle-btn script-content__shot-toggle-btn--video"
                        :class="{
                          'script-content__shot-toggle-btn--active': getShotViewMode(index, sIdx, shotIdx) === 'video'
                        }"
                        @click="handleVideoToggle(index, sIdx, shotIdx)"
                      ><Icon name="lucide:video" size="14" /> 视频</button>
                    </div>
                    <!-- 图片模式下的标签 -->
                    <template v-if="getShotViewMode(index, sIdx, shotIdx) === 'image'">
                      <span class="script-content__shot-type-tag">{{ shotTypeLabel(shot) }}</span>
                      <span class="script-content__shot-angle-tag">{{ shotAngleLabel(shot) }}</span>
                    </template>
                    <!-- 视频模式下的标签 -->
                    <template v-else>
                      <span v-if="getVideoShot(index, shot.shot_number)" class="script-content__video-shot-time">{{ getVideoShot(index, shot.shot_number).time_range }}</span>
                      <span v-if="getVideoShot(index, shot.shot_number)" class="script-content__shot-type-tag">{{ getVideoShot(index, shot.shot_number).type_cn || getVideoShot(index, shot.shot_number).type }}</span>
                    </template>
                    <span class="script-content__shot-duration">{{ shot.duration }}s</span>
                  </div>

                  <!-- ===== 图片镜头内容 ===== -->
                  <div v-show="getShotViewMode(index, sIdx, shotIdx) === 'image'">
                    <div class="script-content__shot-desc">{{ shot.description }}</div>
                    <div v-if="shot.dialogue" class="script-content__shot-dialogue">{{ shot.dialogue }}</div>
                    <div v-if="shot.tags && shot.tags.length" class="script-content__shot-tags">
                      <span v-for="(tag, tIdx) in shot.tags" :key="tIdx" class="script-content__shot-tag">{{ tag }}</span>
                    </div>
                    <div v-if="shotPrompt(shot)" class="script-content__shot-prompt">
                      <span class="script-content__shot-prompt-label">
                        AI Prompt（可点击复制到即梦等平台）
                        <span v-if="copiedShotKey === `${sIdx}-${shotIdx}`" class="script-content__copied-tip">✓ 已复制</span>
                      </span>
                      <div class="script-content__shot-prompt-text" @click="copyPrompt(transformPrompt(shotPrompt(shot)), `${sIdx}-${shotIdx}`)">
                        {{ transformPrompt(shotPrompt(shot)) }}
                      </div>
                    </div>
                  </div>

                  <!-- ===== 视频镜头内容 ===== -->
                  <div v-show="getShotViewMode(index, sIdx, shotIdx) === 'video'">
                    <template v-if="getVideoShot(index, shot.shot_number)">
                      <!-- 运镜 -->
                      <div class="script-content__video-shot-camera">
                        <span class="script-content__video-shot-camera-label">运镜</span>
                        <span>{{ getVideoShot(index, shot.shot_number).camera_cn || getVideoShot(index, shot.shot_number).camera }}</span>
                      </div>
                      <!-- 动态画面描述 -->
                      <div class="script-content__shot-desc">{{ getVideoShot(index, shot.shot_number).visual }}</div>
                      <!-- 关键帧 -->
                      <div v-if="getVideoShot(index, shot.shot_number).keyframes && getVideoShot(index, shot.shot_number).keyframes.length" class="script-content__video-keyframes">
                        <div class="script-content__video-keyframes-label">关键帧</div>
                        <div
                          v-for="(kf, kfIdx) in getVideoShot(index, shot.shot_number).keyframes"
                          :key="kfIdx"
                          class="script-content__video-keyframe-item"
                        >
                          <span class="script-content__video-keyframe-time">{{ kf.time }}</span>
                          <span>{{ kf.state }}</span>
                        </div>
                      </div>
                      <!-- 音频/对白 -->
                      <div v-if="getVideoShot(index, shot.shot_number).audio && getVideoShot(index, shot.shot_number).audio !== 'None'" class="script-content__shot-dialogue">
                        {{ getVideoShot(index, shot.shot_number).audio }}
                      </div>
                      <!-- 转场 -->
                      <div v-if="getVideoShot(index, shot.shot_number).transition && getVideoShot(index, shot.shot_number).transition !== 'End'" class="script-content__video-transition">
                        转场：{{ getVideoShot(index, shot.shot_number).transition }}
                      </div>
                      <!-- 视频生成提示词 -->
                      <div v-if="getVideoShot(index, shot.shot_number).prompt" class="script-content__shot-prompt">
                        <span class="script-content__shot-prompt-label">
                          视频提示词（可点击复制到Sora/可灵等平台）
                          <span v-if="copiedShotKey === `video-${index}-${shotIdx}`" class="script-content__copied-tip">✓ 已复制</span>
                        </span>
                        <div class="script-content__shot-prompt-text" @click="copyPrompt(transformPrompt(getVideoShot(index, shot.shot_number).prompt), `video-${index}-${shotIdx}`)">
                          {{ transformPrompt(getVideoShot(index, shot.shot_number).prompt) }}
                        </div>
                      </div>
                    </template>
                    <!-- 视频分镜未生成：空状态卡片 -->
                    <template v-else>
                      <!-- 当前集正在生成视频分镜中 -->
                      <div v-if="generatingVideoStoryboardIndex === index" class="script-content__shot-video-generating">
                        正在生成视频分镜头提示词...请耐心等待1~3分钟
                      </div>
                      <!-- 未生成：提示 + 生成按钮 -->
                      <div v-else class="script-content__shot-video-empty">
                        <div class="script-content__shot-video-empty-text">
                          视频分镜未生成 — 点击右上角"🎥 生成视频分镜"或下方按钮，将剧本和首帧分镜拆解为AI视频镜头提示词
                        </div>
                        <button
                          class="script-content__action-btn script-content__action-btn--video"
                          :disabled="isVideoStoryboardBtnDisabled(scriptData.episodes[index], index)"
                          @click="emit('generate-video-storyboard', { index })"
                        >
                          <Icon name="lucide:video" size="14" /> 直接生成
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- 生成中时展示加载提示 -->
          <div v-else-if="generatingStoryboardIndex === index" class="script-content__episode-generating">
            正在生成首帧分镜头提示词...请耐心等待1~3分钟
          </div>
          <!-- 无内容时展示提示 -->
          <div v-else class="script-content__episode-empty">
            {{ storyboardEmptyText(ep) }}
          </div>
        </div>
      </div>

    </div>

    <CommonConfirmDialog
      :visible="showExtractConfirm"
      icon="lucide:alert-triangle"
      title="大纲可能尚未生成完成"
      :description="extractConfirmDescription"
      confirm-text="仍然继续提取"
      cancel-text="再等等"
      confirm-type="primary"
      @confirm="confirmExtractScenes"
      @cancel="showExtractConfirm = false"
    />

    <CommonAccessGuardDialog
      :state="guardDialog"
      @update:visible="guardDialog.visible = $event"
      @confirm="handleGuardConfirm"
      @cancel="guardDialog.visible = false"
    />
  </div>
</template>

<script setup>
/**
 * 剧本内容编辑区组件
 * 包含：标题、基本信息、剧情梗概、人物介绍、剧情线、分集大纲
 * 每个区块右上角有锁定按钮，锁定后AI不会覆盖该区块内容
 */
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      title: '',
      basicInfo: '',
      synopsis: '',
      characters: '',
      emotionPoints: '',
      plotLines: '',
      episodes: [
        { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0, storyboardData: null, storyboardStatus: 0, storyboardTotalShots: 0, videoStoryboardData: null, videoStoryboardStatus: 0, videoStoryboardTotalShots: 0 },
      ],
    }),
  },
  aiFillingField: { type: String, default: '' },
  lockState: { type: Object, default: () => ({}) },
  episodeLockState: { type: Array, default: () => [] },
  /** 当前正在生成台本的剧集索引（-1表示无） */
  generatingEpisodeIndex: { type: Number, default: -1 },
  /** 当前正在生成分镜的剧集索引（-1表示无） */
  generatingStoryboardIndex: { type: Number, default: -1 },
  /** 当前正在生成视频分镜的剧集索引（-1表示无） */
  generatingVideoStoryboardIndex: { type: Number, default: -1 },
  /** 是否正在批量生成 */
  isBatchGenerating: { type: Boolean, default: false },
  /** 批量生成进度 { current, total } */
  batchProgress: { type: Object, default: () => ({ current: 0, total: 0 }) },
  /** 结构化角色数据 */
  characterCards: { type: Array, default: () => [] },
  /** 剧本ID（混淆后） */
  scriptId: { type: String, default: '' },
  /** API基础地址 */
  apiBase: { type: String, default: '' },
})

const emit = defineEmits([
  'update:modelValue',
  'update:characterCards',
  'toggle-lock',
  'toggle-episode-lock',
  'generate-episode-script',
  'stop-generate-script',
  'save-script-content',
  'batch-lock',
  'batch-unlock',
  'batch-script-continue',
  'batch-script-clear',
  'batch-script-regenerate',
  'stop-batch-generate',
  'generate-storyboard',
  'stop-generate-storyboard',
  'batch-storyboard-continue',
  'batch-storyboard-clear',
  'batch-storyboard-regenerate',
  'save-storyboard',
  'generate-video-storyboard',
  'stop-generate-video-storyboard',
  'batch-video-storyboard-continue',
  'batch-video-storyboard-clear',
  'batch-video-storyboard-regenerate',
  'save-video-storyboard',
  'parse-characters',
  'save-characters',
])

const scriptData = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const characterCards = computed({
  get: () => props.characterCards,
  set: (val) => emit('update:characterCards', val),
})

const assetTabs = [
  { key: 'intro', label: '人物介绍', icon: 'lucide:file-text' },
  { key: 'character', label: '角色', icon: 'lucide:users' },
  { key: 'scene', label: '场景', icon: 'lucide:map-pin' },
]

const activeAssetTab = ref('intro')
const characterCardsRef = ref(null)
const sceneCardsRef = ref(null)
const sceneCards = ref([])
const sceneExtracting = ref(false)
const sceneExtractProgressText = ref('')
const showExtractConfirm = ref(false)
const pendingExtractForce = ref(false)
const extractConfirmDescription = ref('当前剧本大纲未全部生成，继续提取可能遗漏后续场景。确认继续吗？')
const { showToast } = useToast()
const {
  guardDialog,
  handleGuardConfirm,
  ensureAccess,
} = useAccessGuard()
const { checkSseResponse } = useModelGuard()

/* ========================================
 * AI填充时自动滚动到对应区块
 * ======================================== */
const contentRef = ref(null)

/**
 * 滚动到指定字段的区块
 * @param {string} field - 字段名 (title/basicInfo/synopsis/characters/emotionPoints/plotLines/episode_1/episode_2...)
 */
const scrollToField = (field) => {
  if (!field || !contentRef.value) return

  // 处理剧集字段：episode_1 -> episodes + index
  if (field.startsWith('episode_')) {
    const episodeIndex = parseInt(field.replace('episode_', ''), 10)
    if (isNaN(episodeIndex)) return
    // 滚动到分集区域
    const episodesSection = contentRef.value.querySelector('[data-field="episodes"]')
    if (!episodesSection) return

    // 先确保在大纲Tab，否则切换过去
    if (activeEpisodeTab.value !== 'outline') {
      activeEpisodeTab.value = 'outline'
    }

    // 等待Tab切换完成后再滚动到具体集
    nextTick(() => {
      const episodeCards = episodesSection.querySelectorAll('.script-content__episode')
      const targetEpisode = episodeCards[episodeIndex - 1] // episode_1 对应 index 0
      if (targetEpisode) {
        scrollElementIntoView(targetEpisode)
      }
    })
    return
  }

  // 主字段：直接滚动到对应区块
  const target = contentRef.value.querySelector(`[data-field="${field}"]`)
  if (target) {
    scrollElementIntoView(target)
  }
}

/**
 * 将元素滚动到视图中心
 * @param {HTMLElement} element
 */
const scrollElementIntoView = (element) => {
  if (!element) return
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}

/* 监听 aiFillingField 变化，自动滚动 */
watch(() => props.aiFillingField, (newField) => {
  if (newField) {
    // 稍微延迟一下，确保DOM已经更新（AI填充内容后）
    nextTick(() => {
      scrollToField(newField)
    })
  }
})

const normalizeSceneName = (name) => String(name || '').replace(/\s+/g, '').trim().toLowerCase()

const upsertSceneLocal = (scene) => {
  const key = normalizeSceneName(scene?.name)
  if (!key) return
  const idx = sceneCards.value.findIndex(item => normalizeSceneName(item.name) === key)
  if (idx >= 0) {
    sceneCards.value[idx] = { ...sceneCards.value[idx], ...scene }
  } else {
    sceneCards.value = [...sceneCards.value, scene]
  }
}

const loadSceneCards = async () => {
  if (!props.scriptId) return
  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const res = await $fetch(`${config.public.apiBase}/api/script/${props.scriptId}/scenes`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    sceneCards.value = Array.isArray(res?.data?.scenes) ? res.data.scenes : []
  } catch (e) {
    console.error('加载场景失败:', e)
  }
}

const handleSaveScenes = async (list) => {
  if (!props.scriptId) return
  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const res = await $fetch(`${config.public.apiBase}/api/script/${props.scriptId}/scenes`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: { scenes: list || [] },
    })
    if (Array.isArray(res?.data?.scenes)) {
      sceneCards.value = res.data.scenes
    }
    return true
  } catch (e) {
    console.error('保存场景失败:', e)
    showToast('保存场景失败，请稍后重试', 'error')
    return false
  }
}

const startExtractScenes = async (force = false) => {
  if (!props.scriptId || sceneExtracting.value) return
  sceneExtracting.value = true
  sceneExtractProgressText.value = '1~1/1'

  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const response = await fetch(`${config.public.apiBase}/api/script/${props.scriptId}/scenes/extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      showToast(errData?.message || `场景提取失败（${response.status}），请稍后重试`, 'error')
      return
    }

    /* 检查是否为模型未配置错误（后端返回 JSON 而非 SSE） */
    if (await checkSseResponse(response)) return

    const reader = response.body?.getReader()
    if (!reader) {
      showToast('场景提取失败：响应流不可用', 'error')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (!payload) continue
        try {
          const data = JSON.parse(payload)
          if (data.type === 'start') {
            const total = Number(data.totalEpisodes || 0) || 1
            sceneExtractProgressText.value = `1~1/${total}`
          } else if (data.type === 'progress') {
            const startEp = Number(data.startEpisode || 0)
            const endEp = Number(data.endEpisode || 0)
            const total = Number(data.totalEpisodes || 0)
            if (startEp > 0 && endEp > 0 && total > 0) {
              sceneExtractProgressText.value = `${startEp}~${endEp}/${total}`
            }
          } else if (data.type === 'scene_saved' && data.scene) {
            upsertSceneLocal(data.scene)
          } else if (data.type === 'done') {
            const total = Number(data.totalEpisodes || 0)
            if (total > 0) {
              sceneExtractProgressText.value = `${total}~${total}/${total}`
            }
            if (Array.isArray(data.scenes)) {
              sceneCards.value = data.scenes
            }
            showToast(`场景提取完成，共 ${data.totalScenes || sceneCards.value.length} 个场景`, 'success')
          } else if (data.type === 'error') {
            showToast(data.message || '场景提取失败', 'error')
          }
        } catch (_) {
          // ignore parse error
        }
      }
    }
  } catch (e) {
    console.error('场景提取失败:', e)
    showToast('场景提取失败，请稍后重试', 'error')
  } finally {
    sceneExtracting.value = false
    sceneExtractProgressText.value = ''
  }
}

const confirmExtractScenes = async () => {
  showExtractConfirm.value = false
  const saveOk = await handleSaveScenes(sceneCards.value)
  if (!saveOk) {
    showToast('场景保存失败，已取消提取', 'warning')
    return
  }
  await startExtractScenes(Boolean(pendingExtractForce.value))
}

const handleExtractScenes = async () => {
  if (!props.scriptId || sceneExtracting.value) return
  if (!ensureAccess({ actionName: '场景抽离' })) return
  const saveOk = await handleSaveScenes(sceneCards.value)
  if (!saveOk) {
    showToast('场景保存失败，已取消提取', 'warning')
    return
  }
  try {
    const token = localStorage.getItem('token')
    const config = useRuntimeConfig()
    const res = await $fetch(`${config.public.apiBase}/api/script/${props.scriptId}/scenes/extract-precheck`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = res?.data || {}
    const totalEpisodes = Number(data.totalEpisodes || 0)
    const generatedEpisodes = Number(data.generatedEpisodes || 0)
    const incomplete = Boolean(data.incomplete)

    if (generatedEpisodes <= 0) {
      showToast('暂无可用大纲，请先生成大纲', 'warning')
      return
    }

    if (incomplete) {
      extractConfirmDescription.value = `当前仅有 ${generatedEpisodes}/${totalEpisodes} 集大纲，继续提取可能遗漏后续场景。建议等待大纲完成后再提取。是否继续？`
      pendingExtractForce.value = true
      showExtractConfirm.value = true
      return
    }

    pendingExtractForce.value = false
    await startExtractScenes(false)
  } catch (e) {
    console.error('场景提取预检失败:', e)
    showToast('预检失败，请稍后重试', 'error')
  }
}

watch(() => props.scriptId, () => {
  if (props.scriptId) loadSceneCards()
}, { immediate: true })

/* ---- Tab切换逻辑 ---- */

/** 分集区域的Tab（分镜和视频分镜合并为一个tab） */
const episodeTabs = [
  { key: 'outline', label: '大纲', icon: 'lucide:clipboard-list' },
  { key: 'script', label: '剧本', icon: 'lucide:file-text' },
  { key: 'storyboard', label: '分镜', icon: 'lucide:clapperboard' },
]

/** 当前激活的Tab */
const activeEpisodeTab = ref('outline')

/** 批量操作下拉菜单显示状态 */
const scriptDropdownVisible = ref(false)
const storyboardDropdownVisible = ref(false)
const videoStoryboardDropdownVisible = ref(false)

/** 分镜画风选项 */
const styleOptions = ['日系动漫', '国风水墨', '赛博朋克', '电影写实', '3D渲染', '仙侠古风', '欧美卡通', '韩漫风格']
/** 画风/比例：优先从 scriptData 读取（剧本级全局设置），fallback 默认值 */
const storyboardStyle = ref(scriptData.value?.style || '日系动漫')
const storyboardAspectRatio = ref(scriptData.value?.aspect_ratio || '16:9')

/* 是否正在从外部恢复设置（跳过watch） */
let _skipWatch = false

/* ---- 镜头视图模式（图片/视频切换） ---- */

/** 每个镜头的视图模式：key = `${epIndex}-${sceneIdx}-${shotIdx}`，value = 'image' | 'video' */
const shotViewMode = reactive({})

/** 获取镜头视图模式 */
const getShotViewMode = (epIndex, sceneIdx, shotIdx) => {
  const key = `${epIndex}-${sceneIdx}-${shotIdx}`
  return shotViewMode[key] || 'image'
}

/** 切换镜头视图模式 */
const toggleShotViewMode = (epIndex, sceneIdx, shotIdx, mode) => {
  const key = `${epIndex}-${sceneIdx}-${shotIdx}`
  shotViewMode[key] = mode
}

/** 点击🎥视频toggle：直接切换，card内部处理空状态 */
const handleVideoToggle = (epIndex, sceneIdx, shotIdx) => {
  toggleShotViewMode(epIndex, sceneIdx, shotIdx, 'video')
}

/**
 * 将视频分镜的扁平shots列表按shot_number建立Map
 * 返回 { [epIndex]: { [shot_number]: videoShot } }
 */
const videoShotMap = computed(() => {
  const map = {}
  for (let i = 0; i < (scriptData.value.episodes || []).length; i++) {
    const ep = scriptData.value.episodes[i]
    if (!ep.videoStoryboardData?.shots) continue
    const shotMap = {}
    for (const shot of ep.videoStoryboardData.shots) {
      shotMap[shot.shot_number] = shot
    }
    map[i] = shotMap
  }
  return map
})

/** 根据图片分镜的shot_number获取对应的视频分镜数据 */
const getVideoShot = (epIndex, shotNumber) => {
  return videoShotMap.value[epIndex]?.[shotNumber] || null
}

/* 风格 → prompt中的标准标签映射 */
const STYLE_TAGS_MAP = {
  '日系动漫': '日系动漫风格，赛璐璐上色，鲜艳色彩，2D美学',
  '国风水墨': '中国水墨画风格，空灵，极简，传统国画',
  '赛博朋克': '赛博朋克风格，霓虹灯光，高对比度，未来科技',
  '电影写实': '电影级写实风格，胶片质感，戏剧性光影',
  '3D渲染': '3D渲染风格，体积光，光线追踪，高精度建模',
  '仙侠古风': '仙侠古风风格，中国古代奇幻，神秘空灵，2D电影感',
  '欧美卡通': '欧美卡通风格，粗线条，夸张特征',
  '韩漫风格': '韩漫风格，柔和阴影，精致眼部，浪漫氛围',
}

/* 比例 → 标准标签 */
const RATIO_TARGET = {
  '16:9': '横屏构图，16:9宽画幅',
  '9:16': '竖屏构图，9:16竖画幅',
  '1:1': '方形构图，1:1画幅',
}

/**
 * 构建风格匹配正则（处理AI返回的各种不规范写法）
 * 每种风格用核心特征词构建正则，能匹配到整段风格标签并替换
 */
const STYLE_PATTERNS = {
  '日系动漫': /日系动漫[风格]*[，,\s]*(?:赛璐[璐珞][上着]色[，,\s]*)?(?:鲜艳色彩[，,\s]*)?(?:2D美学)?/g,
  '国风水墨': /中国水墨[画风]*[格]*[，,\s]*(?:空灵[，,\s]*)?(?:极简[，,\s]*)?(?:传统国画)?/g,
  '赛博朋克': /赛博朋克[风格]*[，,\s]*(?:霓虹[灯光]*[，,\s]*)?(?:高对比度[，,\s]*)?(?:未来科技)?/g,
  '电影写实': /电影[级]?写实[风格]*[，,\s]*(?:胶片质感[，,\s]*)?(?:戏剧性光影)?/g,
  '3D渲染': /3[Dd]渲染[风格]*[，,\s]*(?:体积光[，,\s]*)?(?:光线追踪[，,\s]*)?(?:高精度建模)?/g,
  '仙侠古风': /仙侠古风[风格]*[，,\s]*(?:中国古代奇幻[，,\s]*)?(?:神秘空灵[，,\s]*)?(?:2D电影感)?/g,
  '欧美卡通': /欧美卡通[风格]*[，,\s]*(?:粗线条[，,\s]*)?(?:夸张特征)?/g,
  '韩漫风格': /韩漫[风格]*[，,\s]*(?:柔和阴影[，,\s]*)?(?:精致眼部[，,\s]*)?(?:浪漫氛围)?/g,
}

/**
 * 比例匹配正则（覆盖AI可能输出的各种写法）
 * 段1：[横竖方][屏形]?构图 开头，后面可选 数字:数字 + 画幅
 * 段2：数字:数字 开头，后面可选 横竖方/屏形/构图/宽竖/画幅
 */
const RATIO_PATTERN = /[横竖方][屏形]?构图[，,\s]*(?:\d+:\d+)?[宽竖]?画幅?|\d+:\d+[，,\s]*(?:[横竖方][屏形]?构图?|[宽竖]?画幅)/g

/**
 * 动态替换 prompt 中的风格标签和比例标签（读时替换，不修改原始数据）
 * @param {string} rawPrompt - 数据库中的原始 prompt
 * @returns {string} 替换后的 prompt（用于渲染和复制）
 */
const transformPrompt = (rawPrompt) => {
  if (!rawPrompt) return ''
  const targetStyle = storyboardStyle.value
  const targetRatio = storyboardAspectRatio.value
  const targetStyleTags = STYLE_TAGS_MAP[targetStyle]
  const targetRatioLabel = RATIO_TARGET[targetRatio]

  let result = rawPrompt

  /* 1. 替换风格标签：遍历所有已知风格的正则，匹配到任意一种就替换为目标风格 */
  if (targetStyleTags) {
    for (const [styleName, pattern] of Object.entries(STYLE_PATTERNS)) {
      /* 跳过目标风格自身（无需替换） */
      if (styleName === targetStyle) continue
      /* 重置正则lastIndex（全局正则需要） */
      pattern.lastIndex = 0
      if (pattern.test(result)) {
        pattern.lastIndex = 0
        result = result.replace(pattern, targetStyleTags)
        break /* 一个prompt中只会有一种风格，匹配到就停 */
      }
    }
  }

  /* 2. 替换比例标签 */
  if (targetRatioLabel) {
    RATIO_PATTERN.lastIndex = 0
    if (RATIO_PATTERN.test(result)) {
      RATIO_PATTERN.lastIndex = 0
      result = result.replace(RATIO_PATTERN, targetRatioLabel)
    }
  }

  return result
}

/* 监听画风切换 → 更新 script 表 + 同步 scriptData（联动左侧卡片 / 弹窗） */
watch(storyboardStyle, async (newStyle) => {
  if (_skipWatch) return
  scriptData.value = { ...scriptData.value, style: newStyle }
  try {
    const config = useRuntimeConfig()
    const token = localStorage.getItem('token')
    await $fetch(`${config.public.apiBase}/api/script/${props.scriptId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: { style: newStyle },
    })
  } catch (e) {
    console.error('更新画风失败:', e)
  }
})

/* 监听比例切换 → 更新 script 表 + 同步 scriptData（联动左侧卡片 / 弹窗） */
watch(storyboardAspectRatio, async (newRatio) => {
  if (_skipWatch) return
  scriptData.value = { ...scriptData.value, aspect_ratio: newRatio }
  try {
    const config = useRuntimeConfig()
    const token = localStorage.getItem('token')
    await $fetch(`${config.public.apiBase}/api/script/${props.scriptId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: { aspect_ratio: newRatio },
    })
  } catch (e) {
    console.error('更新比例失败:', e)
  }
})

/* 反向同步：外部（弹窗修改等）变更 scriptData.style/aspect_ratio 时，同步到分镜tab的下拉选择 */
watch(
  () => [scriptData.value?.style, scriptData.value?.aspect_ratio],
  ([newStyle, newRatio]) => {
    if (_skipWatch) return
    const shouldSyncStyle = newStyle && newStyle !== storyboardStyle.value
    const shouldSyncRatio = newRatio && newRatio !== storyboardAspectRatio.value
    if (!shouldSyncStyle && !shouldSyncRatio) return
    _skipWatch = true
    if (shouldSyncStyle) storyboardStyle.value = newStyle
    if (shouldSyncRatio) storyboardAspectRatio.value = newRatio
    nextTick(() => { _skipWatch = false })
  },
)

/* 景别英文→中文映射（兼容AI输出英文代码的情况） */
const SHOT_TYPE_MAP = {
  extreme_wide: '大远景', wide: '远景', full: '全景', medium: '中景',
  close_up: '近景', extreme_close_up: '特写', macro: '大特写',
}
const ANGLE_MAP = {
  eye_level: '平视', high_angle: '俯拍', low_angle: '仰拍',
  dutch_angle: '荷兰角', over_shoulder: '过肩', pov: '主观', birds_eye: '鸟瞰',
}

/** 景别标签：优先中文，英文代码自动转中文 */
const shotTypeLabel = (shot) => {
  const val = shot.shot_type || shot.shot_type_code || ''
  return SHOT_TYPE_MAP[val] || val
}

/** 机位标签：优先中文，英文代码自动转中文 */
const shotAngleLabel = (shot) => {
  const val = shot.camera_angle || shot.camera_angle_code || ''
  return ANGLE_MAP[val] || val
}

/** 获取shot的prompt（兼容多种字段名：prompt / prompt_en / prompt_cn） */
const shotPrompt = (shot) => {
  return shot.prompt || shot.prompt_en || shot.prompt_cn || ''
}

/** 分镜生成按钮是否禁用 */
const isStoryboardBtnDisabled = (ep, index) => {
  /* 无台本内容 → 禁用 */
  if (!ep.scriptContent || !ep.scriptContent.trim()) return true
  /* 正在生成首帧中（任意一集） → 禁用 */
  if (props.generatingStoryboardIndex >= 0) return true
  /* 当前集正在生成视频分镜 → 禁用（避免重新生成首帧导致视频分镜数据错乱） */
  if (props.generatingVideoStoryboardIndex === index) return true
  return false
}

/** 分镜生成按钮文案 */
const storyboardBtnText = (ep, index) => {
  if (props.generatingStoryboardIndex === index) return '生成中...'
  if (ep.storyboardStatus === 2 && ep.storyboardData) return '重新生成首帧'
  if (ep.storyboardStatus === 3) return '重试生成首帧'
  return '生成首帧分镜'
}

/** 分镜空状态文案 */
const storyboardEmptyText = (ep) => {
  if (!ep.scriptContent || !ep.scriptContent.trim()) {
    return '请先生成剧本，再生成分镜头提示词'
  }
  if (ep.storyboardStatus === 3) {
    return '分镜生成失败，请点击"重试生成"'
  }
  return '首帧分镜未生成 — 点击"生成首帧分镜"将台本拆解为AI动漫分首帧镜头提示词'
}

/* ---- 视频分镜按钮逻辑 ---- */

/** 视频分镜生成按钮是否禁用 */
const isVideoStoryboardBtnDisabled = (ep, index) => {
  /* 无静态分镜数据 → 禁用 */
  if (!ep.storyboardData || !ep.storyboardData.scenes) return true
  /* 静态分镜未完成 → 禁用 */
  if (ep.storyboardStatus !== 2) return true
  /* 正在生成中（任意一集） → 禁用 */
  if (props.generatingVideoStoryboardIndex >= 0) return true
  return false
}

/** 视频分镜生成按钮文案 */
const videoStoryboardBtnText = (ep, index) => {
  if (props.generatingVideoStoryboardIndex === index) return '生成中...'
  if (ep.videoStoryboardStatus === 2 && ep.videoStoryboardData) return '重新生成视频'
  if (ep.videoStoryboardStatus === 3) return '重试生成视频'
  return '生成视频分镜'
}

/** 视频分镜空状态文案 */
const videoStoryboardEmptyText = (ep) => {
  if (!ep.storyboardData || !ep.storyboardData.scenes || ep.storyboardStatus !== 2) {
    return '请先生成静态分镜，再生成视频分镜词'
  }
  if (ep.videoStoryboardStatus === 3) {
    return '视频分镜生成失败，请点击"重试生成"'
  }
  return '视频分镜未生成 — 点击"生成视频分镜"将静态分镜转化为动态视频提示词'
}

/** 当前已复制的镜头标识（用于显示"已复制"提示） */
const copiedShotKey = ref('')
let _copiedTimer = null

/** 复制提示词到剪贴板 */
const copyPrompt = async (text, shotKey) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    /* 降级方案 */
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  /* 显示"已复制"提示，2秒后自动消失 */
  copiedShotKey.value = shotKey
  clearTimeout(_copiedTimer)
  _copiedTimer = setTimeout(() => { copiedShotKey.value = '' }, 2000)
}

/* 添加一集 */
const addEpisode = () => {
  const updated = { ...props.modelValue }
  updated.episodes = [...updated.episodes, { title: '', content: '', scriptContent: '', scriptStatus: 0, scriptLocked: 0, storyboardData: null, storyboardStatus: 0, storyboardTotalShots: 0, videoStoryboardData: null, videoStoryboardStatus: 0, videoStoryboardTotalShots: 0 }]
  emit('update:modelValue', updated)
}

/* ---- 台本生成按钮逻辑 ---- */

/** 台本生成按钮是否禁用 */
const isGenerateBtnDisabled = (ep, index) => {
  /* 无大纲内容 → 禁用 */
  if (!ep.content || !ep.content.trim()) return true
  /* 正在生成中（任意一集） → 禁用 */
  if (props.generatingEpisodeIndex >= 0) return true
  return false
}

/** 台本生成按钮文案 */
const generateBtnText = (ep, index) => {
  if (props.generatingEpisodeIndex === index) return '生成中...'
  if (ep.scriptStatus === 2 && ep.scriptContent) return '重新生成'
  if (ep.scriptStatus === 3) return '重试生成'
  return '生成剧本'
}

/* ---- 锁定按钮逻辑（主字段） ---- */

/** 锁定按钮文案：空内容→未填写，有内容未锁定→点击锁定，已锁定→已锁定 */
const lockBtnText = (field, content) => {
  if (!content) return '未填写'
  return props.lockState[field] ? '已锁定' : '点击锁定'
}

/** 锁定按钮样式class */
const lockBtnClass = (field, content) => {
  if (!content) return 'script-content__lock-btn--empty'
  return props.lockState[field]
    ? 'script-content__lock-btn--locked'
    : 'script-content__lock-btn--unlocked'
}

/** 切换锁定状态 */
const toggleLock = (field) => {
  emit('toggle-lock', field)
}

/* ---- 锁定按钮逻辑（剧集） ---- */

const episodeLockBtnText = (index) => {
  return props.episodeLockState[index] ? '已锁定' : '点击锁定'
}

const episodeLockBtnClass = (index) => {
  return props.episodeLockState[index]
    ? 'script-content__lock-btn--locked'
    : 'script-content__lock-btn--unlocked'
}

const toggleEpisodeLock = (index) => {
  emit('toggle-episode-lock', index)
}

/**
 * 从外部设置画风/比例（页面加载恢复时调用）
 * _skipWatch 避免触发 watch 导致不必要的替换
 */
const setStoryboardSettings = (style, aspectRatio) => {
  _skipWatch = true
  if (style && styleOptions.includes(style)) {
    storyboardStyle.value = style
  }
  if (aspectRatio && ['16:9', '9:16', '1:1'].includes(aspectRatio)) {
    storyboardAspectRatio.value = aspectRatio
  }
  nextTick(() => { _skipWatch = false })
}

/**
 * 收到一批视频分镜数据后，自动将对应镜头的卡片切换到视频tab
 * 根据 shot_number 在 scenes 中定位 sceneIdx 和 shotIdx
 * @param {number} epIndex - 剧集索引
 * @param {Array} videoShots - 本批视频分镜shots（含 shot_number）
 */
const switchShotsToVideo = (epIndex, videoShots) => {
  const ep = scriptData.value.episodes[epIndex]
  if (!ep?.storyboardData?.scenes) return

  const scenes = ep.storyboardData.scenes
  for (const vs of videoShots) {
    const shotNum = vs.shot_number
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const shots = scenes[sIdx].shots || []
      for (let shotIdx = 0; shotIdx < shots.length; shotIdx++) {
        if (shots[shotIdx].shot_number === shotNum) {
          shotViewMode[`${epIndex}-${sIdx}-${shotIdx}`] = 'video'
        }
      }
    }
  }
}

/**
 * 将指定集的所有镜头卡片切换到视频tab
 * 点击生成视频分镜时调用，让用户立即看到视频区域
 * @param {number} epIndex - 剧集索引
 */
const switchAllShotsToVideo = (epIndex) => {
  const ep = scriptData.value.episodes[epIndex]
  if (!ep?.storyboardData?.scenes) return

  const scenes = ep.storyboardData.scenes
  for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
    const shots = scenes[sIdx].shots || []
    for (let shotIdx = 0; shotIdx < shots.length; shotIdx++) {
      shotViewMode[`${epIndex}-${sIdx}-${shotIdx}`] = 'video'
    }
  }
}

defineExpose({
  setStoryboardSettings,
  switchShotsToVideo,
  switchAllShotsToVideo,
  scrollToField,
  scrollToEpisode: (index) => scrollToField(`episode_${index + 1}`),
})
</script>

<style scoped>
/* ========================================
 * 剧本内容编辑区
 * ======================================== */
.script-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 内容区块 */
.script-content__section {
  background: var(--color-bg-white);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  padding: 20px;
  overflow: hidden;
}

/* 分集区域：去掉overflow:hidden，让sticky生效 */
.script-content__section--episodes {
  overflow: visible;
}

/* Tab栏吸顶 */
.script-content__section-header--sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-white);
  margin: -20px -20px 0;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--color-border-light);
  border-radius: var(--radius) var(--radius) 0 0;
}

/* sticky header下方的内容区需要上间距 */
.script-content__section--episodes .script-content__episodes {
  margin-top: 14px;
}

.script-content__section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 20;
  margin-bottom: 14px;
}

.script-content__section-header--assets {
  align-items: center;
}

.script-content__section-icon {
  font-size: 18px;
}

.script-content__section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.script-content__section-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

/* 标题输入 */
.script-content__title-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
}

.script-content__title-input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08);
}

/* 文本域 */
.script-content__textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.script-content__textarea:focus {
  border-color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.08);
}

.script-content__textarea::placeholder {
  color: var(--color-text-light);
}

.script-content__asset-panel {
  margin-top: 2px;
}

/* 分集大纲 */
.script-content__episodes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Tab切换 */
.script-content__tabs {
  display: flex;
  gap: 4px;
  background: var(--color-bg);
  border-radius: 8px;
  padding: 3px;
}

.script-content__tab {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.script-content__tab:hover {
  color: var(--color-text);
  background: var(--color-bg-white);
}

.script-content__tab--active {
  color: var(--color-primary);
  background: var(--color-bg-white);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

/* 剧本/分镜面板 */
.script-content__storyboard-panel {
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  padding: 16px;
  border: 1px solid var(--color-border-light);
}

/* 操作按钮 */
.script-content__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
}

.script-content__action-spin {
  animation: script-content-spin 0.9s linear infinite;
}

@keyframes script-content-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.script-content__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.script-content__action-btn--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.script-content__action-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
  color: #fff;
}

/* 小尺寸操作按钮（嵌入episode-header） */
.script-content__action-btn--sm {
  padding: 2px 10px;
  font-size: 11px;
  flex-shrink: 0;
}

/* 集标题文本（只读展示） */
.script-content__episode-title-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 集内简洁空状态提示 */
.script-content__episode-empty {
  font-size: 12px;
  color: var(--color-text-light);
  line-height: 1.6;
  padding: 12px 14px;
  background: var(--color-bg-white);
  border-radius: var(--radius-xs);
  border: 1px dashed var(--color-border-light);
}

/* 台本生成中提示 */
.script-content__episode-generating {
  font-size: 12px;
  color: var(--color-primary);
  line-height: 1.6;
  padding: 12px 14px;
  margin-top: 14px;
  background: var(--color-primary-bg);
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-primary);
  animation: ai-fill-pulse 1.5s ease-in-out infinite;
}

/* 生成中的剧集卡片高亮 */
.script-content__episode--generating {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1);
}

/* 分镜预览 */
.script-content__storyboard-preview {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed var(--color-border);
}

.script-content__storyboard-preview-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-light);
  margin-bottom: 12px;
}

.script-content__shot-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.script-content__shot-card {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  transition: border-color 0.2s;
}

/* .script-content__shot-card:hover {
  border-color: var(--color-border);
} */

.script-content__shot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.script-content__shot-num {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  padding: 1px 8px;
  border-radius: 10px;
}

.script-content__shot-type {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  padding: 1px 8px;
  border-radius: 10px;
}

.script-content__shot-duration {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.script-content__shot-visual {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text);
  margin-bottom: 6px;
}

.script-content__shot-dialogue {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-primary);
  font-style: italic;
  margin-bottom: 6px;
  padding-left: 8px;
  border-left: 2px solid var(--color-primary);
}

.script-content__shot-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-light);
}

.script-content__episode {
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  padding:0 14px 14px 14px;
  border: 1px solid var(--color-border-light);
  transition: border-color 0.2s;
}

.script-content__episode:hover {
  border-color: var(--color-border);
}

.script-content__episode-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  padding-top: 14px;
  position: sticky;
  top: 63px;
  background: var(--color-bg);
  z-index: 10;
}

.script-content__episode-num {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-primary);
  color: #fff;
  white-space: nowrap;
}

.script-content__episode-title-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  outline: none;
  transition: all 0.2s;
}

.script-content__episode-title-input:focus {
  border-color: var(--color-border);
  background: var(--color-bg-white);
}

.script-content__textarea--episode {
  background: var(--color-bg-white);
}

/* 添加集按钮 */
.script-content__add-episode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  background: transparent;
  transition: all 0.2s;
}

.script-content__add-episode:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

/* 锁定按钮 */
.script-content__lock-btn {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  line-height: 1.6;
}

/* 未填写：灰色禁用态 */
.script-content__lock-btn--empty {
  background: var(--color-bg);
  color: var(--color-text-light);
  cursor: not-allowed;
  border-color: var(--color-border-light);
}

/* 有内容未锁定：可点击态 */
.script-content__lock-btn--unlocked {
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

.script-content__lock-btn--unlocked:hover {
  background: #fff3e0;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 已锁定：强调态 */
.script-content__lock-btn--locked {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.script-content__lock-btn--locked:hover {
  opacity: 0.85;
}

/* 剧集内的锁定按钮：稍小一点 */
.script-content__lock-btn--episode {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 8px;
}

/* AI填充高亮动画 */
.script-content__section--ai-filling {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12);
  animation: ai-fill-pulse 1.5s ease-out;
}

.script-content__episode--ai-filling {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  animation: ai-fill-pulse 1.5s ease-out;
}

@keyframes ai-fill-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(255, 107, 53, 0.15); }
  100% { box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12); }
}

/* Tab右侧功能区 */
.script-content__tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* 全部锁定/解锁按钮：灰色胶囊，与集数badge风格一致 */
.script-content__batch-lock-btn {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.script-content__batch-lock-btn:hover {
  background: var(--color-bg-hover, #e8e8e8);
  color: var(--color-text);
}

/* Tab提示文字（大纲Tab） */
.script-content__tab-hint {
  font-size: 12px;
  color: var(--color-text-light);
  white-space: nowrap;
}

/* 批量操作下拉容器 */
.script-content__batch-dropdown {
  position: relative;
}

/* 批量生成按钮：高度和字体与全部锁定一致，保持方形 */
.script-content__batch-dropdown > .script-content__action-btn {
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  line-height: inherit;
}

/* 批量操作下拉菜单 */
.script-content__batch-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 20;
  min-width: 80px;
  padding: 3px 0;
}

/* 透明桥接层：消除按钮和菜单之间的间隙 */
.script-content__batch-menu::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
}

.script-content__batch-menu-item {
  display: block;
  width: 100%;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  white-space: nowrap;
}

.script-content__batch-menu-item:hover {
  background: var(--color-bg);
}

.script-content__batch-menu-item--danger {
  color: #e53935;
}

.script-content__batch-menu-item--danger:hover {
  background: #fef2f2;
}

/* 批量生成进度状态 */
.script-content__batch-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.script-content__batch-progress {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 500;
  white-space: nowrap;
}

/* 停止生成按钮（危险色） */
.script-content__action-btn--danger {
  background: #e53935;
  color: #fff;
  border: none;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.script-content__action-btn--danger:hover {
  background: #c62828;
}

/* ========================================
 * 分镜Tab专属样式
 * ======================================== */

/* 分镜全局设置栏 */
.script-content__storyboard-settings {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
}

.script-content__setting-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.script-content__setting-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.script-content__setting-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text);
  background: var(--color-bg-white);
  outline: none;
  cursor: pointer;
}

.script-content__setting-select:focus {
  border-color: var(--color-primary);
}

/* 分镜状态标签 */
.script-content__storyboard-badge {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.script-content__storyboard-badge--done {
  background: #e8f5e9;
  color: #2e7d32;
}

/* 场景区块 */
.script-content__storyboard-scenes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.script-content__scene-block {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.script-content__scene-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border-light);
  flex-wrap: wrap;
}

.script-content__scene-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.script-content__scene-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.script-content__scene-meta {
  font-size: 11px;
  color: var(--color-text-light);
}

.script-content__scene-mood {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-left: auto;
  font-style: italic;
}

/* 镜头卡片列表 */
.script-content__shot-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-border-light);
}

.script-content__shot-card {
  padding: 10px 12px;
  background: var(--color-bg-white);
}

.script-content__shot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.script-content__shot-num {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
}

.script-content__shot-type-tag {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 4px;
  background: #e3f2fd;
  color: #1565c0;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: 0.3px;
}

.script-content__shot-angle-tag {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 4px;
  background: #f3e5f5;
  color: #7b1fa2;
  font-family: monospace;
  letter-spacing: 0.3px;
}

.script-content__shot-duration {
  font-size: 10px;
  color: var(--color-text-light);
  margin-left: auto;
}

.script-content__shot-desc {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.7;
  margin-bottom: 6px;
}

.script-content__shot-dialogue {
  font-size: 12px;
  color: #d84315;
  padding: 4px 8px;
  background: #fff3e0;
  border-radius: 4px;
  margin-bottom: 6px;
  border-left: 2px solid #ff9800;
}

/* 标签组 */
.script-content__shot-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.script-content__shot-tag {
  font-size: 10px;
  color: var(--color-text-secondary);
  padding: 1px 6px;
  background: var(--color-bg);
  border-radius: 3px;
  border: 1px solid var(--color-border-light);
}

/* 英文AI提示词区域 */
.script-content__shot-prompt {
  margin-top: 8px;
  border-top: 1px dashed var(--color-border-light);
  padding-top: 6px;
}

.script-content__shot-prompt-label {
  font-size: 10px;
  font-weight: 600;
  color: #2e7d32;
  margin-bottom: 3px;
  display: block;
}

.script-content__shot-prompt-text {
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  padding: 6px 8px;
  background: #f1f8e9;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  word-break: break-all;
}

.script-content__shot-prompt-text:hover {
  background: #dcedc8;
}

.script-content__copied-tip {
  color: #2e7d32;
  font-weight: 500;
  font-size: 11px;
  margin-left: 6px;
  animation: copiedFadeIn 0.2s ease;
}

@keyframes copiedFadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
/* ========================================
 * 视频分镜Tab专属样式
 * ======================================== */

.script-content__video-shot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.script-content__video-shot-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.script-content__video-shot-time {
  font-size: 11px;
  color: #8b5cf6;
  background: #f5f3ff;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.script-content__video-shot-camera {
  font-size: 12px;
  color: #555;
  display: flex;
  align-items: center;
  gap: 6px;
}

.script-content__video-shot-camera-label {
  font-size: 10px;
  color: #fff;
  background: #8b5cf6;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.script-content__video-keyframes {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.script-content__video-keyframes-label {
  font-size: 10px;
  color: #8b5cf6;
  font-weight: 600;
  margin-bottom: 2px;
}

.script-content__video-keyframe-item {
  font-size: 11px;
  color: #555;
  display: flex;
  gap: 8px;
  line-height: 1.5;
}

.script-content__video-keyframe-time {
  font-size: 10px;
  color: #8b5cf6;
  background: #f5f3ff;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.script-content__video-transition {
  font-size: 11px;
  color: #888;
  font-style: italic;
  padding-top: 4px;
  border-top: 1px dashed #eee;
}

/* ========================================
 * 镜头内 图片/视频 Toggle 切换
 * ======================================== */

/* toggle容器 */
.script-content__shot-toggle {
  display: flex;
  gap: 0;
  background: #f0f0f0;
  border-radius: 6px;
  padding: 2px;
  flex-shrink: 0;
}

/* toggle按钮 */
.script-content__shot-toggle-btn {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: var(--color-text-light);
  transition: all 0.2s;
  line-height: 14px;
  white-space: nowrap;
}

.script-content__shot-toggle-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.6);
}

/* 图片模式激活态：橙色 */
.script-content__shot-toggle-btn--active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
}

.script-content__shot-toggle-btn--active:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}

/* 视频模式激活态：紫色 */
.script-content__shot-toggle-btn--video.script-content__shot-toggle-btn--active {
  background: #8b5cf6;
  color: #fff;
  box-shadow: 0 1px 3px rgba(139, 92, 246, 0.3);
}

.script-content__shot-toggle-btn--video.script-content__shot-toggle-btn--active:hover:not(:disabled) {
  background: #8b5cf6;
  color: #fff;
}

/* 视频按钮禁用态（无视频分镜数据） */
.script-content__shot-toggle-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 视频模式下的card边框变紫色 */
.script-content__shot-card--video-mode {
  border-color: #d8b4fe;
  background: #faf5ff;
}

/* 视频分镜未生成的提示 */
.script-content__shot-empty-hint {
  font-size: 12px;
  color: var(--color-text-light);
  padding: 8px 0;
  font-style: italic;
}

/* 镜头card内：视频分镜空状态 */
.script-content__shot-video-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  background: #faf5ff;
  border: 1px dashed #d8b4fe;
  border-radius: 6px;
  text-align: center;
}

.script-content__shot-video-empty-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* 镜头card内：视频分镜生成中 */
.script-content__shot-video-generating {
  padding: 16px 12px;
  background: #f5f3ff;
  border: 1px solid #d8b4fe;
  border-radius: 6px;
  font-size: 12px;
  color: #8b5cf6;
  text-align: center;
  animation: ai-fill-pulse 1.5s ease-in-out infinite;
}

/* 视频分镜按钮样式（紫色） */
.script-content__action-btn--video {
  background: #8b5cf6;
  color: #fff;
  border-color: #8b5cf6;
}

.script-content__action-btn--video:hover:not(:disabled) {
  opacity: 0.9;
  color: #fff;
}

/* 视频分镜状态标签（紫色，有数据） */
.script-content__storyboard-badge--video {
  background: #eee4f8;
  color: #8b5cf6;
}

/* 视频分镜状态标签（灰色，0个） */
.script-content__storyboard-badge--video-empty {
  background: #f0f0f0;
  color: #999;
}

/* 视频分镜生成中（紫色闪烁） */
.script-content__storyboard-badge--video-generating {
  background: #eee4f8;
  color: #8b5cf6;
  animation: badge-pulse 1.5s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

</style>
