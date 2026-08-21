<script setup lang="ts">
import { Clock3, Heart, Pause } from '@lucide/vue'

defineProps<{
  levelNumber: number
  difficulty: 'normal' | 'hard'
  lives: number
  timeRemaining: number
}>()

const emit = defineEmits<{
  pause: []
}>()

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
</script>

<template>
  <header class="hud">
    <div class="hud__level">
      <span class="hud__eyebrow">关卡 {{ levelNumber }}</span>
      <strong>{{ difficulty === 'hard' ? '困难' : '普通' }}</strong>
    </div>
    <div class="hud__status" aria-live="polite">
      <span class="hud__lives" :aria-label="`${lives} 点生命`">
        <Heart v-for="heart in lives" :key="heart" :size="20" fill="currentColor" aria-hidden="true" />
      </span>
      <span class="hud__time" :aria-label="`剩余时间 ${formatTime(timeRemaining)}`">
        <Clock3 :size="20" aria-hidden="true" />
        {{ formatTime(timeRemaining) }}
      </span>
    </div>
    <button class="icon-button" type="button" title="暂停" aria-label="暂停" @click="emit('pause')">
      <Pause :size="19" aria-hidden="true" />
    </button>
  </header>
</template>
