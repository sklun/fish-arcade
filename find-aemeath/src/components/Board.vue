<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Cell, Level, Point } from '@/game/model'

const props = defineProps<{
  level: Level
  iconUrl: string
  disabled?: boolean
  hintedCellKey?: string | null
  errorCellKey?: string | null
  autoMarkOrigin?: Point | null
}>()

const emit = defineEmits<{
  mark: [point: Point]
  reveal: [point: Point]
}>()

const clickTimer = ref<number | undefined>()
const lastKeyAction = ref<{ key: string; at: number } | null>(null)

const cells = computed(() => props.level.cells)
const regionColors = computed(() => new Map(props.level.regions.map((region) => [region.id, region.color])))
const autoMarkMinimumDistance = computed(() => {
  const origin = props.autoMarkOrigin
  if (!origin) return 0
  const distances = props.level.cells
    .filter((cell) => cell.status === 'auto-flagged')
    .map((cell) => Math.hypot(cell.row - origin.row, cell.col - origin.col))
  return distances.length > 0 ? Math.min(...distances) : 0
})

const clearClickTimer = (): void => {
  if (clickTimer.value !== undefined) window.clearTimeout(clickTimer.value)
  clickTimer.value = undefined
}

const queueSingle = (cell: Cell): void => {
  if (props.disabled) return
  clearClickTimer()
  clickTimer.value = window.setTimeout(() => {
    emit('mark', { row: cell.row, col: cell.col })
    clickTimer.value = undefined
  }, 300)
}

const triggerDouble = (cell: Cell): void => {
  if (props.disabled) return
  clearClickTimer()
  emit('reveal', { row: cell.row, col: cell.col })
}

const keyboardAction = (cell: Cell): void => {
  if (props.disabled) return
  const key = `${cell.row},${cell.col}`
  const now = Date.now()
  if (lastKeyAction.value?.key === key && now - lastKeyAction.value.at <= 300) {
    emit('reveal', { row: cell.row, col: cell.col })
    lastKeyAction.value = null
  } else {
    emit('mark', { row: cell.row, col: cell.col })
    lastKeyAction.value = { key, at: now }
  }
}

const statusLabel = (cell: Cell): string => {
  if (cell.status === 'revealed-target') return '已找到爱弥斯'
  if (cell.status === 'revealed-empty') return '错误，没有目标'
  if (cell.status === 'flagged') return '已标记'
  if (cell.status === 'auto-flagged') return '自动标记，无目标'
  return '未探索'
}

const cellStyle = (cell: Cell): Record<string, string> => {
  const origin = props.autoMarkOrigin
  const distance = origin && cell.status === 'auto-flagged'
    ? Math.hypot(cell.row - origin.row, cell.col - origin.col)
    : 0
  return {
    '--region-color': regionColors.value.get(cell.regionId) ?? '#527996',
    '--auto-mark-delay': `${Math.round(Math.max(0, distance - autoMarkMinimumDistance.value) * 72)}ms`,
  }
}

onBeforeUnmount(clearClickTimer)
</script>

<template>
  <div
    class="board-shell"
    :style="{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }"
    role="grid"
    :aria-label="`${level.rows} 行 ${level.cols} 列爱弥斯搜索棋盘`"
  >
    <button
      v-for="cell in cells"
      :key="`${cell.row}-${cell.col}`"
      class="board-cell"
      :class="[
        `board-cell--${cell.status}`,
        { 'board-cell--hinted': hintedCellKey === `${cell.row},${cell.col}`,
          'board-cell--error': errorCellKey === `${cell.row},${cell.col}` },
      ]"
      :style="cellStyle(cell)"
      :data-row="cell.row"
      :data-col="cell.col"
      type="button"
      role="gridcell"
      :aria-label="`第 ${cell.row + 1} 行第 ${cell.col + 1} 列，${statusLabel(cell)}`"
      :disabled="disabled"
      @click="queueSingle(cell)"
      @dblclick.prevent="triggerDouble(cell)"
      @keydown.enter.prevent="keyboardAction(cell)"
      @keydown.space.prevent="keyboardAction(cell)"
    >
      <span v-if="cell.status === 'flagged' || cell.status === 'auto-flagged'" class="board-cell__mark" aria-hidden="true">×</span>
      <img v-else-if="cell.status === 'revealed-target'" class="board-cell__icon" :src="iconUrl" alt="爱弥斯" />
      <span v-else-if="cell.status === 'revealed-empty'" class="board-cell__wrong" aria-hidden="true">!</span>
    </button>
  </div>
</template>
