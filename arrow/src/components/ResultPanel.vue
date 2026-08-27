<script lang="ts" setup>
import {ArrowRight, Gamepad2, RotateCcw, Trophy} from '@lucide/vue'

defineProps<{
  success: boolean
  failureReason: 'time' | 'lives' | null
  levelNumber: number
  elapsedSeconds: number
  lives: number
}>()

defineEmits<{
  next: []
  retry: []
  home: []
}>()

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
</script>

<template>
  <section :class="{ 'result-panel--failed': !success }" class="result-panel">
    <div aria-hidden="true" class="result-panel__mark">
      <Trophy v-if="success" :size="30"/>
      <span v-else>!</span>
    </div>
    <span class="result-panel__label">关卡 {{ levelNumber }}</span>
    <h1>{{ success ? '全部放行' : failureReason === 'time' ? '时间已到' : '生命耗尽' }}</h1>
    <dl class="result-panel__stats">
      <div>
        <dt>耗时</dt>
        <dd>{{ formatDuration(elapsedSeconds) }}</dd>
      </div>
      <div>
        <dt>生命</dt>
        <dd>{{ lives }}</dd>
      </div>
    </dl>
    <div class="result-panel__actions">
      <button v-if="success" class="primary-button" type="button" @click="$emit('next')">
        下一关
        <ArrowRight :size="19" aria-hidden="true"/>
      </button>
      <button v-else class="primary-button" type="button" @click="$emit('retry')">
        <RotateCcw :size="19" aria-hidden="true"/>
        再试一次
      </button>
      <button class="text-button" type="button" @click="$emit('home')">
        <Gamepad2 :size="18" aria-hidden="true"/>
        返回游戏中心
      </button>
    </div>
  </section>
</template>
