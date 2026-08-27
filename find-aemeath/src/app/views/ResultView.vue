<script lang="ts" setup>
import {computed} from 'vue'
import {ArrowRight, Gamepad2, RotateCcw, Sparkles} from '@lucide/vue'
import {useRouter} from 'vue-router'

import {useGameStore} from '@/app/stores/game'

const router = useRouter()
const store = useGameStore()
const success = computed(() => store.status === 'success')
const title = computed(() => success.value ? '目标已锁定' : '信号中断')
const description = computed(() => success.value ? '所有区域的爱弥斯都已找到。' : '生命值归零，需要重新校准。')

const retry = async (): Promise<void> => {
  store.restartLevel()
  await router.push('/game')
}

const next = async (): Promise<void> => {
  store.nextLevel()
  await router.push('/game')
}

</script>

<template>
  <main :class="{ 'result-screen--failure': !success }" class="result-screen">
    <div class="result-card">
      <span class="result-card__icon"><Sparkles v-if="success" :size="27"/><span v-else>!</span></span>
      <span class="hud__eyebrow">{{ success ? 'SIGNAL CONFIRMED' : 'SIGNAL LOST' }}</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <div class="result-stats">
        <span><small>关卡</small><b>{{ store.currentLevelIndex + 1 }}</b></span>
        <span><small>用时</small><b>{{ store.elapsedSeconds }}s</b></span>
        <span><small>剩余生命</small><b>{{ store.lives }}</b></span>
      </div>
      <button v-if="success" class="primary-button primary-button--large" type="button" @click="next">下一关
        <ArrowRight :size="19"/>
      </button>
      <button v-else class="primary-button primary-button--large" type="button" @click="retry">
        <RotateCcw :size="19"/>
        再次尝试
      </button>
      <div class="result-links">
        <a class="text-button platform-link" href="/">
          <Gamepad2 :size="16"/>
          返回游戏中心</a>
      </div>
    </div>
  </main>
</template>
