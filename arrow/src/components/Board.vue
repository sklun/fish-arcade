<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { ArrowAnimation } from '@/app/stores/game'
import { DIRECTION_VECTOR, playableCellsFor, type Arrow, type Direction, type Level, type Point } from '@/game/model'

const props = defineProps<{
  level: Level
  animation?: ArrowAnimation | null
  disabled?: boolean
  decorative?: boolean
}>()

const emit = defineEmits<{
  select: [arrowId: string]
}>()

const directionLabels: Record<Direction, string> = {
  up: '上',
  'up-right': '右上',
  right: '右',
  'down-right': '右下',
  down: '下',
  'down-left': '左下',
  left: '左',
  'up-left': '左上',
}

const aliveArrows = computed(() => props.level.arrows.filter((arrow) => arrow.alive))
const playableCells = computed(() => playableCellsFor(props.level))
const animationProgress = ref(0)
let animationFrameId: number | undefined

const stopAnimation = (): void => {
  if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId)
  animationFrameId = undefined
}

watch(
  () => props.animation,
  (animation) => {
    stopAnimation()
    animationProgress.value = 0
    if (!animation || typeof window === 'undefined') return
    const startedAt = performance.now()
    const duration = animation.kind === 'exit' ? 320 : 240
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration)
      animationProgress.value = progress
      if (progress < 1 && props.animation?.arrowId === animation.arrowId) {
        animationFrameId = window.requestAnimationFrame(tick)
      }
    }
    animationFrameId = window.requestAnimationFrame(tick)
  },
  { immediate: true },
)

onBeforeUnmount(stopAnimation)

const pathPoints = (cells: Point[]): string => cells.map((cell) => `${cell.col},${cell.row}`).join(' ')

const headTransform = (arrow: Arrow, cells: Point[]): string => {
  const vector = DIRECTION_VECTOR[arrow.direction]
  const head = cells[cells.length - 1] ?? arrow.head
  const angle = Math.atan2(vector.row, vector.col) * (180 / Math.PI)
  return `translate(${head.col} ${head.row}) rotate(${angle})`
}

const displayCells = (arrow: Arrow): Point[] => {
  const animation = props.animation
  if (!animation || animation.arrowId !== arrow.id || animation.frames.length === 0) return arrow.cells

  const states = [arrow.cells, ...animation.frames]
  const lastIndex = states.length - 1
  const travelProgress =
    animation.kind === 'collision'
      ? animationProgress.value < 0.72
        ? animationProgress.value / 0.72
        : (1 - animationProgress.value) / 0.28
      : animationProgress.value
  const position = Math.max(0, Math.min(lastIndex, travelProgress * lastIndex))
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.min(lastIndex, lowerIndex + 1)
  const fraction = position - lowerIndex
  const lower = states[lowerIndex] ?? arrow.cells
  const upper = states[upperIndex] ?? lower
  return lower.map((cell, index) => {
    const next = upper[index] ?? cell
    return {
      row: cell.row + (next.row - cell.row) * fraction,
      col: cell.col + (next.col - cell.col) * fraction,
    }
  })
}

const selectArrow = (arrowId: string): void => {
  if (!props.disabled && !props.decorative) emit('select', arrowId)
}
</script>

<template>
  <div
    class="board-shell"
    :class="{ 'board-shell--decorative': decorative, 'board-shell--shaped': Boolean(level.playableCells) }"
    :style="{ aspectRatio: `${level.cols + 0.2} / ${level.rows + 0.2}` }"
  >
    <svg
      class="board"
      :viewBox="`-0.6 -0.6 ${level.cols + 0.2} ${level.rows + 0.2}`"
      :aria-label="decorative ? undefined : `${level.rows} 行 ${level.cols} 列箭头棋盘`"
      :aria-hidden="decorative ? 'true' : undefined"
      preserveAspectRatio="xMidYMid meet"
    >
      <g class="board__region" aria-hidden="true">
        <rect
          v-for="cell in playableCells"
          :key="`surface-${cell.row}-${cell.col}`"
          :x="cell.col - 0.5"
          :y="cell.row - 0.5"
          width="1"
          height="1"
          class="board__surface"
        />
        <circle
          v-for="cell in playableCells"
          :key="`grid-${cell.row}-${cell.col}`"
          :cx="cell.col"
          :cy="cell.row"
          r=".055"
          class="board__grid-dot"
        />
      </g>

      <g
        v-for="arrow in aliveArrows"
        :key="arrow.id"
        class="board-arrow"
        :class="{
          'board-arrow--highlighted': arrow.highlighted,
          'board-arrow--collision': animation?.arrowId === arrow.id && animation.kind === 'collision',
          'board-arrow--exiting': animation?.arrowId === arrow.id && animation.kind === 'exit',
          'board-arrow--disabled': disabled,
        }"
        :style="{ '--arrow-color': arrow.color }"
        :role="decorative ? undefined : 'button'"
        :tabindex="decorative || disabled ? -1 : 0"
        :aria-label="decorative ? undefined : `箭头 ${arrow.id}，方向${directionLabels[arrow.direction]}`"
        :data-arrow-id="arrow.id"
        @click="selectArrow(arrow.id)"
        @keydown.enter.prevent="selectArrow(arrow.id)"
        @keydown.space.prevent="selectArrow(arrow.id)"
      >
        <polyline class="board-arrow__hit" :points="pathPoints(displayCells(arrow))" />
        <polyline class="board-arrow__line" :points="pathPoints(displayCells(arrow))" />
        <path
          class="board-arrow__head"
          d="M .38 0 L -.3 -.3 L -.3 .3 Z"
          :transform="headTransform(arrow, displayCells(arrow))"
        />
      </g>
    </svg>
  </div>
</template>
