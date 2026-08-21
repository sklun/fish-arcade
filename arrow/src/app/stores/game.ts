import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { generateLevel } from '@/game/generator'
import { cloneLevel, type Level, type Point } from '@/game/model'
import { movableArrowIds, traceArrowMovement } from '@/game/movement'
import { getLevelProfile } from '@/game/progression'
import { loadProgress, saveProgress } from '@/storage/progress'

export type GameStatus = 'home' | 'playing' | 'paused' | 'success' | 'failed'
export type FailureReason = 'time' | 'lives' | null

export interface ArrowAnimation {
  arrowId: string
  kind: 'exit' | 'collision'
  steps: number
  frames: Point[][]
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const useGameStore = defineStore('game', () => {
  const saved = loadProgress()
  const status = ref<GameStatus>('home')
  const currentLevelIndex = ref(saved.highestLevel)
  const highestLevel = ref(saved.highestLevel)
  const level = ref<Level | null>(null)
  const lives = ref(3)
  const timeRemaining = ref(0)
  const hintsRemaining = ref(3)
  const failureReason = ref<FailureReason>(null)
  const inputLocked = ref(false)
  const animation = ref<ArrowAnimation | null>(null)
  const theme = ref<'dark' | 'light'>(saved.theme)
  const soundEnabled = ref(saved.soundEnabled)

  const profile = computed(() => getLevelProfile(currentLevelIndex.value))
  const elapsedSeconds = computed(() =>
    level.value ? Math.max(0, level.value.timeLimitSec - timeRemaining.value) : 0,
  )
  const aliveCount = computed(() => level.value?.arrows.filter((arrow) => arrow.alive).length ?? 0)

  const persist = (): void => {
    saveProgress({
      highestLevel: highestLevel.value,
      theme: theme.value,
      soundEnabled: soundEnabled.value,
    })
  }

  const playSound = (kind: 'exit' | 'collision'): void => {
    if (!soundEnabled.value || typeof window === 'undefined') return
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const duration = kind === 'exit' ? 0.12 : 0.16
    oscillator.type = kind === 'exit' ? 'sine' : 'sawtooth'
    oscillator.frequency.setValueAtTime(kind === 'exit' ? 620 : 145, context.currentTime)
    gain.gain.setValueAtTime(0.045, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration)
    oscillator.addEventListener('ended', () => void context.close())
  }

  const applyTheme = (): void => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.value
  }

  const startLevel = (levelIndex = currentLevelIndex.value): void => {
    currentLevelIndex.value = Math.max(0, Math.floor(levelIndex))
    const nextLevel = generateLevel(currentLevelIndex.value)
    level.value = cloneLevel(nextLevel)
    lives.value = getLevelProfile(currentLevelIndex.value).lives
    timeRemaining.value = nextLevel.timeLimitSec
    hintsRemaining.value = 3
    failureReason.value = null
    inputLocked.value = false
    animation.value = null
    status.value = 'playing'
  }

  const restartLevel = (): void => startLevel(currentLevelIndex.value)

  const nextLevel = (): void => startLevel(currentLevelIndex.value + 1)

  const pause = (): void => {
    if (status.value === 'playing' && !inputLocked.value) status.value = 'paused'
  }

  const resume = (): void => {
    if (status.value === 'paused') status.value = 'playing'
  }

  const goHome = (): void => {
    status.value = 'home'
    inputLocked.value = false
    animation.value = null
  }

  const tick = (seconds = 1): void => {
    if (status.value !== 'playing') return
    timeRemaining.value = Math.max(0, timeRemaining.value - Math.max(0, seconds))
    if (timeRemaining.value === 0) {
      failureReason.value = 'time'
      status.value = 'failed'
      inputLocked.value = false
    }
  }

  const finishSuccess = (): void => {
    status.value = 'success'
    highestLevel.value = Math.max(highestLevel.value, currentLevelIndex.value + 1)
    persist()
  }

  const attemptArrow = async (arrowId: string): Promise<'exit' | 'collision' | 'ignored'> => {
    if (status.value !== 'playing' || inputLocked.value || !level.value) return 'ignored'
    const target = level.value.arrows.find((arrow) => arrow.id === arrowId && arrow.alive)
    if (!target) return 'ignored'

    inputLocked.value = true
    target.highlighted = false
    const trace = traceArrowMovement(level.value, arrowId)
    if (trace.canExit) {
      playSound('exit')
      animation.value = { arrowId, kind: 'exit', steps: trace.exitStep ?? 1, frames: trace.frames }
      await delay(320)
      target.alive = false
      animation.value = null
      inputLocked.value = false
      if (aliveCount.value === 0) finishSuccess()
      return 'exit'
    }

    lives.value = Math.max(0, lives.value - 1)
    playSound('collision')
    animation.value = { arrowId, kind: 'collision', steps: trace.collisionStep ?? 1, frames: trace.frames }
    await delay(240)
    animation.value = null
    inputLocked.value = false
    if (lives.value === 0) {
      failureReason.value = 'lives'
      status.value = 'failed'
    }
    return 'collision'
  }

  const useHint = (): string | null => {
    if (status.value !== 'playing' || inputLocked.value || hintsRemaining.value <= 0 || !level.value) {
      return null
    }
    for (const arrow of level.value.arrows) arrow.highlighted = false
    const hintId = movableArrowIds(level.value)[0] ?? null
    if (!hintId) return null
    const target = level.value.arrows.find((arrow) => arrow.id === hintId)
    if (target) target.highlighted = true
    hintsRemaining.value -= 1
    window.setTimeout(() => {
      if (target) target.highlighted = false
    }, 1500)
    return hintId
  }

  const toggleTheme = (): void => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme()
    persist()
  }

  const toggleSound = (): void => {
    soundEnabled.value = !soundEnabled.value
    persist()
  }

  applyTheme()

  return {
    status,
    currentLevelIndex,
    highestLevel,
    level,
    lives,
    timeRemaining,
    hintsRemaining,
    failureReason,
    inputLocked,
    animation,
    theme,
    soundEnabled,
    profile,
    elapsedSeconds,
    aliveCount,
    startLevel,
    restartLevel,
    nextLevel,
    pause,
    resume,
    goHome,
    tick,
    attemptArrow,
    useHint,
    toggleTheme,
    toggleSound,
  }
})
