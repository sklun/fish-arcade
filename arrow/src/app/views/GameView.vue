<script lang="ts" setup>
import {onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {Gamepad2, Lightbulb, Moon, RotateCcw, Sun, Volume2, VolumeX} from '@lucide/vue'

import {useGameStore} from '@/app/stores/game'
import Board from '@/components/Board.vue'
import Hud from '@/components/Hud.vue'
import PauseOverlay from '@/components/PauseOverlay.vue'

const router = useRouter()
const route = useRoute()
const store = useGameStore()
const notice = ref('')
let timerId: number | undefined

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

const hint = (): void => {
  notice.value = store.useHint() ? '' : '当前没有可移动的箭头'
}

const handleKeyboard = (event: KeyboardEvent): void => {
  const target = event.target as HTMLElement | null
  if (target?.matches('button, select, input')) return
  if (event.key.toLowerCase() === 'h') hint()
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
    store.status === 'paused' ? store.resume() : store.pause()
  }
}

watch(
    () => store.status,
    async (status) => {
      if (status === 'success' || status === 'failed') await router.push('/result')
    },
)

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
  <main class="game-screen">
    <Hud
        :difficulty="store.profile.difficulty"
        :level-number="store.currentLevelIndex + 1"
        :lives="store.lives"
        :time-remaining="store.timeRemaining"
        @pause="store.pause"
    />

    <section aria-label="游戏区域" class="game-stage">
      <Board
          v-if="store.level"
          :animation="store.animation"
          :disabled="store.inputLocked || store.status !== 'playing'"
          :level="store.level"
          @select="store.attemptArrow"
      />
      <span aria-live="polite" class="game-stage__count">剩余 {{ store.aliveCount }}</span>
    </section>

    <footer class="game-tools">
      <span class="game-tools__notice" role="status">{{ notice }}</span>
      <div class="game-tools__actions">
        <a class="tool-button platform-link" href="/" title="返回游戏中心">
          <Gamepad2 :size="19" aria-hidden="true"/>
          <span>游戏中心</span>
        </a>
        <button :disabled="store.hintsRemaining === 0" class="tool-button tool-button--accent" type="button" @click="hint">
          <Lightbulb :size="19" aria-hidden="true"/>
          <span>提示 <b>{{ store.hintsRemaining }}</b></span>
        </button>
        <button class="tool-button" title="重新开始" type="button" @click="restart">
          <RotateCcw :size="19" aria-hidden="true"/>
          <span>重来</span>
        </button>
        <button
            :title="store.soundEnabled ? '关闭音效' : '开启音效'"
            class="tool-button"
            type="button"
            @click="store.toggleSound"
        >
          <Volume2 v-if="store.soundEnabled" :size="19" aria-hidden="true"/>
          <VolumeX v-else :size="19" aria-hidden="true"/>
          <span>音效</span>
        </button>
        <button
            :title="store.theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
            class="tool-button"
            type="button"
            @click="store.toggleTheme"
        >
          <Sun v-if="store.theme === 'dark'" :size="19" aria-hidden="true"/>
          <Moon v-else :size="19" aria-hidden="true"/>
          <span>主题</span>
        </button>
      </div>
    </footer>

    <PauseOverlay
        v-if="store.status === 'paused'"
        @home="returnToCenter"
        @restart="restart"
        @resume="store.resume"
    />
  </main>
</template>
