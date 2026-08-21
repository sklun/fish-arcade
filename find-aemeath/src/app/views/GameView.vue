<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Eye, Flag, Gamepad2, RotateCcw, Settings2, Trash2, Volume2, VolumeX } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import { useGameStore } from '@/app/stores/game'
import Board from '@/components/Board.vue'
import Hud from '@/components/Hud.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import type { Point } from '@/game/model'
import { BACKGROUND_ASSETS, ICON_ASSETS } from '@/game/assets'

const router = useRouter()
const route = useRoute()
const store = useGameStore()
const notice = ref('')
let timerId: number | undefined

const handleMark = (point: Point): void => {
  notice.value = ''
  store.markCell(point)
}

const handleReveal = async (point: Point): Promise<void> => {
  notice.value = ''
  const result = await store.revealCell(point)
  if (result === 'empty') notice.value = '错误信号，生命 -1'
  if (result === 'target') {
    notice.value = store.autoMark
      ? store.lastAutoMarkedCount > 0
        ? `已自动标记 ${store.lastAutoMarkedCount} 格`
        : '没有可自动标记的格子'
      : '自动标记已关闭'
  }
}

const useHint = (): void => {
  notice.value = store.useHint() ? '目标信号已短暂标记' : '当前没有可提示的目标'
}

const restart = (): void => {
  notice.value = ''
  store.restartLevel()
}

const returnToCenter = (): void => {
  store.goHome()
  window.location.assign('/')
}

const requestedLevel = (): number => {
  const value = Array.isArray(route.query.level) ? route.query.level[0] : route.query.level
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  return Number.isInteger(parsed)
    ? Math.min(store.highestLevel, Math.max(0, parsed))
    : store.currentLevelIndex
}

const reset = (): void => {
  if (window.confirm('确认重置全部关卡进度吗？')) store.resetProgress()
}

const handleKeyboard = (event: KeyboardEvent): void => {
  const target = event.target as HTMLElement | null
  if (target?.matches('button, input, select, textarea')) return
  if (event.key.toLowerCase() === 'h') useHint()
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
    if (store.status === 'paused') store.resume()
    else store.pause()
  }
}

watch(() => store.status, async (status) => {
  if (status === 'success' || status === 'failed') await router.push('/result')
})

onMounted(() => {
  if (!store.level || store.status === 'home') store.startLevel(requestedLevel())
  timerId = window.setInterval(() => store.tick(), 1000)
  window.addEventListener('keydown', handleKeyboard)
})

onBeforeUnmount(() => {
  if (timerId !== undefined) window.clearInterval(timerId)
  window.removeEventListener('keydown', handleKeyboard)
})
</script>

<template>
  <main class="game-screen" :style="{ '--game-image': `url(${store.backgroundUrl})` }">
    <Hud
      :level-number="store.currentLevelIndex + 1"
      :difficulty="store.profile.difficulty"
      :lives="store.lives"
      :elapsed-seconds="store.elapsedSeconds"
      :found-count="store.foundCount"
      :target-count="store.targetCount"
      @pause="store.pause"
    />

    <div class="game-subbar">
      <a class="text-button platform-link" href="/"><Gamepad2 :size="16" />游戏中心</a>
      <span class="game-subbar__hint">每色、每行、每列各 1 个且互不相邻 · 单击标记，双击翻开</span>
      <span class="game-subbar__status" role="status">{{ notice }}</span>
    </div>

    <section class="game-stage" aria-label="游戏区域">
      <div class="game-stage__glow" aria-hidden="true" />
      <Board
        v-if="store.level"
        :level="store.level"
        :icon-url="store.iconUrl"
        :disabled="store.inputLocked || store.status !== 'playing'"
        :hinted-cell-key="store.hintedCellKey"
        :error-cell-key="store.errorCellKey"
        :auto-mark-origin="store.autoMarkOrigin"
        @mark="handleMark"
        @reveal="handleReveal"
      />
      <div class="game-stage__footer"><span>{{ store.remainingTargets }} 个目标待定位</span><span>{{ store.progressPercent }}% 已同步</span></div>
    </section>

    <footer class="game-tools">
      <span class="game-tools__notice">{{ notice }}</span>
      <div class="game-tools__actions">
        <button class="tool-button tool-button--accent" type="button" @click="useHint"><Eye :size="19" /><span>目标提示</span></button>
        <button class="tool-button" type="button" title="清除玩家标记" @click="store.clearPlayerMarks"><Trash2 :size="19" /><span>清除标记</span></button>
        <button class="tool-button" :class="{ 'tool-button--active': store.autoMark }" type="button" @click="store.toggleAutoMark"><Flag :size="19" /><span>自动标记</span></button>
        <button class="tool-button" type="button" title="重新开始" @click="restart"><RotateCcw :size="19" /><span>重来</span></button>
        <button class="tool-button" type="button" title="设置" @click="store.toggleSettings"><Settings2 :size="19" /><span>设置</span></button>
        <button class="tool-button" type="button" :title="store.soundEnabled ? '关闭音效' : '开启音效'" @click="store.toggleSound">
          <Volume2 v-if="store.soundEnabled" :size="19" /><VolumeX v-else :size="19" /><span>音效</span>
        </button>
      </div>
    </footer>

    <PauseOverlay v-if="store.status === 'paused'" @resume="store.resume" @restart="restart" @home="returnToCenter" />
    <SettingsPanel
      v-if="store.settingsPanelOpen"
      :auto-mark="store.autoMark"
      :sound-enabled="store.soundEnabled"
      :theme="store.theme"
      @close="store.toggleSettings"
      @toggle-auto-mark="store.toggleAutoMark"
      @toggle-sound="store.toggleSound"
      @toggle-theme="store.toggleTheme"
      @reset="reset"
      :icon-asset="store.iconAsset"
      :background-asset="store.backgroundAsset"
      :icon-options="ICON_ASSETS"
      :background-options="BACKGROUND_ASSETS"
      @select-icon="store.setIconAsset"
      @select-background="store.setBackgroundAsset"
    />
  </main>
</template>
