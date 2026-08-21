<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useGameStore } from '@/app/stores/game'
import ResultPanel from '@/components/ResultPanel.vue'

const router = useRouter()
const store = useGameStore()

const next = async (): Promise<void> => {
  store.nextLevel()
  await router.push('/game')
}

const retry = async (): Promise<void> => {
  store.restartLevel()
  await router.push('/game')
}

const home = (): void => {
  store.goHome()
  window.location.assign('/')
}

onMounted(async () => {
  if (store.status !== 'success' && store.status !== 'failed') await router.replace('/game')
})
</script>

<template>
  <main class="result-screen">
    <span class="wordmark">ARROW <b>箭序</b></span>
    <ResultPanel
      :success="store.status === 'success'"
      :failure-reason="store.failureReason"
      :level-number="store.currentLevelIndex + 1"
      :elapsed-seconds="store.elapsedSeconds"
      :lives="store.lives"
      @next="next"
      @retry="retry"
      @home="home"
    />
  </main>
</template>
