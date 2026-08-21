<script setup lang="ts">
import { Check, RotateCcw, Volume2, VolumeX, X } from '@lucide/vue'
import type { AssetOption } from '@/game/assets'

defineProps<{
  autoMark: boolean
  soundEnabled: boolean
  theme: 'dark' | 'light' | 'high-contrast'
  iconAsset: string
  backgroundAsset: string
  iconOptions: AssetOption[]
  backgroundOptions: AssetOption[]
}>()

defineEmits<{
  close: []
  toggleAutoMark: []
  toggleSound: []
  toggleTheme: []
  reset: []
  selectIcon: [assetId: string]
  selectBackground: [assetId: string]
}>()

const selectValue = (event: Event): string =>
  event.target instanceof HTMLSelectElement ? event.target.value : ''
</script>

<template>
  <div class="overlay" role="presentation" @click.self="$emit('close')">
    <section class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="panel-heading">
        <div><span class="hud__eyebrow">SYSTEM CONFIG</span><h2 id="settings-title">设置</h2></div>
        <button class="icon-button" type="button" aria-label="关闭设置" title="关闭" @click="$emit('close')"><X :size="20" /></button>
      </div>
      <button class="setting-row" type="button" @click="$emit('toggleAutoMark')">
        <span><b>自动标记</b><small>找到目标后标记全盘排除格</small></span>
        <span class="toggle" :class="{ 'toggle--on': autoMark }"><Check v-if="autoMark" :size="15" /></span>
      </button>
      <button class="setting-row" type="button" @click="$emit('toggleSound')">
        <span><b>反馈音效</b><small>正确和错误操作的提示音</small></span>
        <span class="setting-icon"><Volume2 v-if="soundEnabled" :size="20" /><VolumeX v-else :size="20" /></span>
      </button>
      <button class="setting-row" type="button" @click="$emit('toggleTheme')">
        <span><b>显示主题</b><small>{{ theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '高对比度' }}</small></span>
        <span class="setting-value">切换</span>
      </button>
      <label class="setting-row setting-row--select">
        <span><b>目标图标</b><small>选择揭示后的目标素材</small></span>
        <select :value="iconAsset" @change="$emit('selectIcon', selectValue($event))">
          <option v-for="option in iconOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </label>
      <label class="setting-row setting-row--select">
        <span><b>场景背景</b><small>选择棋盘背后的场景素材</small></span>
        <select :value="backgroundAsset" @change="$emit('selectBackground', selectValue($event))">
          <option v-for="option in backgroundOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </label>
      <button class="setting-row setting-row--danger" type="button" @click="$emit('reset')">
        <span><b>重置进度</b><small>清除本游戏保存的关卡进度</small></span>
        <RotateCcw :size="19" />
      </button>
    </section>
  </div>
</template>
