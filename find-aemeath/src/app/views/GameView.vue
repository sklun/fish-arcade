<script lang="ts" setup>
import {onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {Eye, Flag, Gamepad2, RotateCcw, Settings2, Trash2} from '@lucide/vue'
import {useRoute, useRouter} from 'vue-router'

import {useGameStore} from '@/app/stores/game'
import Board from '@/components/Board.vue'
import Hud from '@/components/Hud.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import type {Point} from '@/game/model'
import {BACKGROUND_ASSETS, ICON_ASSETS} from '@/game/assets'

const router = useRouter()
const route = useRoute()
const store = useGameStore()
const notice = ref('')
let timerId: number | undefined

const handleMark = (point: Point): void => {
  notice.value = ''
  store.markCell(point)
}

const markKnownTargets = (): void => {
  const markedCount = store.markKnownTargets()
  notice.value = markedCount > 0
      ? `已手动标记 ${markedCount} 格`
      : store.foundCount > 0
          ? '没有可手动标记的格子'
          : '尚未发现目标'
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
  <main :style="{ '--game-image': `url(${store.backgroundUrl})` }" class="game-screen">
    <Hud
        :difficulty="store.profile.difficulty"
        :elapsed-seconds="store.elapsedSeconds"
        :found-count="store.foundCount"
        :level-number="store.currentLevelIndex + 1"
        :lives="store.lives"
        :target-count="store.targetCount"
        @pause="store.pause"
    />

    <div class="game-subbar">
      <a class="text-button platform-link" href="/">
        <Gamepad2 :size="16"/>
        游戏中心</a>
      <span class="game-subbar__hint">每色、每行、每列各 1 个且互不相邻 · 单击标记，双击翻开</span>
    </div>

    <section aria-label="游戏区域" class="game-stage">
      <div aria-hidden="true" class="game-stage__glow"/>
      <Board
          v-if="store.level"
          :auto-mark-origin="store.autoMarkOrigin"
          :disabled="store.inputLocked || store.status !== 'playing'"
          :error-cell-key="store.errorCellKey"
          :hinted-cell-key="store.hintedCellKey"
          :icon-url="store.iconUrl"
          :level="store.level"
          @mark="handleMark"
          @reveal="handleReveal"
      />
      <div class="game-stage__footer"><span>{{ store.remainingTargets }} 个目标待定位</span><span>{{ store.progressPercent }}% 已同步</span></div>
    </section>

    <footer class="game-tools">
      <span class="game-tools__notice">{{ notice }}</span>
      <div class="game-tools__actions">
        <button class="tool-button tool-button--accent" type="button" @click="useHint">
          <Eye :size="19"/>
          <span>目标提示</span></button>
        <button :disabled="store.status !== 'playing' || store.inputLocked" class="tool-button" title="标记已发现目标排除的格子" type="button" @click="markKnownTargets">
          <Flag :size="19"/>
          <span>手动标记</span></button>
        <button class="tool-button" title="清除玩家标记" type="button" @click="store.clearPlayerMarks">
          <Trash2 :size="19"/>
          <span>清除标记</span></button>
        <button class="tool-button" title="重新开始" type="button" @click="restart">
          <RotateCcw :size="19"/>
          <span>重来</span></button>
        <button class="tool-button" title="设置" type="button" @click="store.toggleSettings">
          <Settings2 :size="19"/>
          <span>设置</span></button>
      </div>
    </footer>

    <PauseOverlay v-if="store.status === 'paused'" @home="returnToCenter" @restart="restart" @resume="store.resume"/>
    <SettingsPanel
        v-if="store.settingsPanelOpen"
        :auto-mark="store.autoMark"
        :background-asset="store.backgroundAsset"
        :background-options="BACKGROUND_ASSETS"
        :icon-asset="store.iconAsset"
        :icon-options="ICON_ASSETS"
        :sound-enabled="store.soundEnabled"
        :theme="store.theme"
        @close="store.toggleSettings"
        @reset="reset"
        @toggle-auto-mark="store.toggleAutoMark"
        @toggle-sound="store.toggleSound"
        @toggle-theme="store.toggleTheme"
        @select-icon="store.setIconAsset"
        @select-background="store.setBackgroundAsset"
    />
  </main>
</template>
