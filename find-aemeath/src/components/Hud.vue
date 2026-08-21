<script setup lang="ts">
import { Heart, Pause } from '@lucide/vue'

defineProps<{
  levelNumber: number
  difficulty: 'normal' | 'hard'
  lives: number
  elapsedSeconds: number
  foundCount: number
  targetCount: number
}>()

defineEmits<{ pause: [] }>()

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
</script>

<template>
  <header class="hud">
    <div class="hud__brand">
      <span class="hud__eyebrow">FIND AEMEATH</span>
      <h1>寻找爱弥斯</h1>
    </div>
    <div class="hud__level">
      <span>第 {{ levelNumber }} 关</span>
      <strong :class="{ 'hud__hard': difficulty === 'hard' }">{{ difficulty === 'hard' ? '困难' : '普通' }}</strong>
    </div>
    <div class="hud__stats">
      <span class="hud-stat" aria-label="已找到目标">
        <b>{{ foundCount }}</b><small>/ {{ targetCount }}</small>
      </span>
      <span class="hud-stat" aria-label="本关用时">
        <b>{{ formatTime(elapsedSeconds) }}</b>
      </span>
      <span class="hud-lives" aria-label="剩余生命">
        <Heart v-for="index in 3" :key="index" :size="17" :fill="index <= lives ? 'currentColor' : 'none'" :class="{ 'hud-lives__empty': index > lives }" aria-hidden="true" />
      </span>
      <button class="icon-button" type="button" aria-label="暂停" title="暂停" @click="$emit('pause')">
        <Pause :size="19" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>
