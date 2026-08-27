<script lang="ts" setup>
import {Gamepad2, Play, RotateCcw, Settings2} from '@lucide/vue'

defineEmits<{
  resume: []
  restart: []
  home: []
}>()
</script>

<template>
  <div class="overlay overlay--pause">
    <section aria-labelledby="pause-title" aria-modal="true" class="pause-panel" role="dialog">
      <span class="pause-panel__icon"><Settings2 :size="23" aria-hidden="true"/></span>
      <span class="pause-panel__eyebrow">游戏已暂停</span>
      <h2 id="pause-title">先理清，再出发</h2>
      <p>棋盘和倒计时已暂停</p>
      <button autofocus class="primary-button" type="button" @click="$emit('resume')">
        <Play :size="18" aria-hidden="true" fill="currentColor"/>
        继续
      </button>
      <div class="pause-panel__links">
        <button class="text-button" type="button" @click="$emit('restart')">
          <RotateCcw :size="16" aria-hidden="true"/>
          重新开始
        </button>
        <button class="text-button" type="button" @click="$emit('home')">
          <Gamepad2 :size="16" aria-hidden="true"/>
          返回游戏中心
        </button>
      </div>
    </section>
  </div>
</template>
