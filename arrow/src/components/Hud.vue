<script lang="ts" setup>
import {Clock3, Heart, Pause} from '@lucide/vue'

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
    <div aria-live="polite" class="hud__status">
      <span :aria-label="`${lives} 点生命`" class="hud__lives">
        <Heart v-for="heart in lives" :key="heart" :size="20" aria-hidden="true" fill="currentColor"/>
      </span>
      <span :aria-label="`剩余时间 ${formatTime(timeRemaining)}`" class="hud__time">
        <Clock3 :size="20" aria-hidden="true"/>
        {{ formatTime(timeRemaining) }}
      </span>
    </div>
    <button aria-label="暂停" class="icon-button" title="暂停" type="button" @click="emit('pause')">
      <Pause :size="19" aria-hidden="true"/>
    </button>
  </header>
</template>
