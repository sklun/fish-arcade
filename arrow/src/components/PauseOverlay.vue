<script setup lang="ts">
import { Gamepad2, Play, RotateCcw } from '@lucide/vue'

defineEmits<{
  resume: []
  restart: []
  home: []
}>()
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
    <section class="dialog-panel">
      <span class="dialog-panel__label">游戏已暂停</span>
      <h2 id="pause-title">先理清，再出发</h2>
      <div class="dialog-panel__actions">
        <button class="primary-button" type="button" autofocus @click="$emit('resume')">
          <Play :size="19" fill="currentColor" aria-hidden="true" />
          继续
        </button>
        <button class="secondary-button" type="button" @click="$emit('restart')">
          <RotateCcw :size="19" aria-hidden="true" />
          重新开始
        </button>
        <button class="text-button" type="button" @click="$emit('home')">
          <Gamepad2 :size="18" aria-hidden="true" />
          返回游戏中心
        </button>
      </div>
    </section>
  </div>
</template>
