<script setup lang="ts">
import { Gamepad2, Play, RotateCcw, Settings2 } from '@lucide/vue'

defineEmits<{
  resume: []
  restart: []
  home: []
}>()
</script>

<template>
  <div class="overlay overlay--pause">
    <section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <span class="pause-panel__icon"><Settings2 :size="23" aria-hidden="true" /></span>
      <span class="pause-panel__eyebrow">游戏已暂停</span>
      <h2 id="pause-title">先理清，再出发</h2>
      <p>棋盘和倒计时已暂停</p>
      <button class="primary-button" type="button" autofocus @click="$emit('resume')">
        <Play :size="18" fill="currentColor" aria-hidden="true" />
        继续
      </button>
      <div class="pause-panel__links">
        <button class="text-button" type="button" @click="$emit('restart')">
          <RotateCcw :size="16" aria-hidden="true" />重新开始
        </button>
        <button class="text-button" type="button" @click="$emit('home')">
          <Gamepad2 :size="16" aria-hidden="true" />返回游戏中心
        </button>
      </div>
    </section>
  </div>
</template>
