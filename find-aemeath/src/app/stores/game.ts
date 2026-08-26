import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { generateLevel } from '@/game/generator'
import { assetUrl, BACKGROUND_ASSETS, ICON_ASSETS } from '@/game/assets'
import { cloneLevel, pointKey, type Cell, type CellStatus, type Level, type Point } from '@/game/model'
import { getLevelProfile } from '@/game/progression'
import { clearProgress, loadProgress, saveProgress } from '@/storage/progress'

export type GameStatus = 'home' | 'playing' | 'paused' | 'success' | 'failed'

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const useGameStore = defineStore('aemeath-game', () => {
  const saved = loadProgress()
  const status = ref<GameStatus>('home')
  const currentLevelIndex = ref(saved.currentLevel)
  const highestLevel = ref(saved.highestLevel)
  const level = ref<Level | null>(null)
  const lives = ref(3)
  const elapsedSeconds = ref(0)
  const inputLocked = ref(false)
  const errorCellKey = ref<string | null>(null)
  const hintedCellKey = ref<string | null>(null)
  const lastAutoMarkedCount = ref(0)
  const autoMarkOrigin = ref<Point | null>(null)
  const autoMark = ref(saved.autoMark)
  const soundEnabled = ref(saved.sound)
  const theme = ref(saved.theme)
  const iconAsset = ref(saved.iconAsset)
  const backgroundAsset = ref(saved.backgroundAsset)
  const settingsPanelOpen = ref(false)

  const profile = computed(() => getLevelProfile(currentLevelIndex.value))
  const cells = computed(() => level.value?.cells ?? [])
  const targetCount = computed(() => level.value?.regions.length ?? 0)
  const foundCount = computed(() => cells.value.filter((cell) => cell.status === 'revealed-target').length)
  const remainingTargets = computed(() => Math.max(0, targetCount.value - foundCount.value))
  const progressPercent = computed(() =>
    targetCount.value > 0 ? Math.round((foundCount.value / targetCount.value) * 100) : 0,
  )
  const excludedByTarget = (cell: Cell, target: Cell): boolean =>
    cell.regionId === target.regionId ||
    cell.row === target.row ||
    cell.col === target.col ||
    (Math.abs(cell.row - target.row) <= 1 && Math.abs(cell.col - target.col) <= 1)
  const knownTargetMarkableCount = computed(() => {
    const targets = cells.value.filter((cell) => cell.status === 'revealed-target')
    return cells.value.filter((cell) =>
      cell.status === 'hidden' && targets.some((target) => excludedByTarget(cell, target)),
    ).length
  })
  const iconUrl = computed(() => assetUrl(ICON_ASSETS, iconAsset.value))
  const backgroundUrl = computed(() => assetUrl(BACKGROUND_ASSETS, backgroundAsset.value))

  const persist = (): void => {
    saveProgress({
      highestLevel: highestLevel.value,
      currentLevel: currentLevelIndex.value,
      autoMark: autoMark.value,
      sound: soundEnabled.value,
      theme: theme.value,
      iconAsset: iconAsset.value,
      backgroundAsset: backgroundAsset.value,
    })
  }

  const applyTheme = (): void => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.value
  }

  const playFeedback = (kind: 'success' | 'error'): void => {
    if (!soundEnabled.value || typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = kind === 'success' ? 'sine' : 'triangle'
    oscillator.frequency.value = kind === 'success' ? 560 : 120
    gain.gain.setValueAtTime(0.035, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.14)
    oscillator.addEventListener('ended', () => void context.close())
  }

  const startLevel = (levelIndex = currentLevelIndex.value): void => {
    currentLevelIndex.value = Math.max(0, Math.floor(levelIndex))
    const nextLevel = generateLevel(currentLevelIndex.value)
    level.value = cloneLevel(nextLevel)
    lives.value = profile.value.lives
    elapsedSeconds.value = 0
    errorCellKey.value = null
    hintedCellKey.value = null
    lastAutoMarkedCount.value = 0
    autoMarkOrigin.value = null
    inputLocked.value = false
    status.value = 'playing'
    persist()
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
    persist()
  }

  const tick = (seconds = 1): void => {
    if (status.value !== 'playing') return
    const elapsed = Math.max(0, Math.floor(seconds))
    elapsedSeconds.value += elapsed
  }

  const findCell = (point: Point): Cell | undefined =>
    level.value?.cells.find((cell) => cell.row === point.row && cell.col === point.col)

  const setCellStatus = (cell: Cell, nextStatus: CellStatus): void => {
    cell.status = nextStatus
    errorCellKey.value = nextStatus === 'revealed-empty' ? pointKey(cell) : null
  }

  const markCell = (point: Point): void => {
    if (status.value !== 'playing' || inputLocked.value) return
    const cell = findCell(point)
    if (!cell) return
    if (cell.status === 'hidden') setCellStatus(cell, 'flagged')
    else if (cell.status === 'flagged') setCellStatus(cell, 'hidden')
    else if (cell.status === 'revealed-empty') errorCellKey.value = pointKey(cell)
  }

  const autoMarkFromTarget = (target: Cell): number => {
    if (!autoMark.value || !level.value) return 0
    let markedCount = 0
    for (const cell of level.value.cells) {
      if (excludedByTarget(cell, target) && cell.status === 'hidden') {
        cell.status = 'auto-flagged'
        markedCount += 1
      }
    }
    return markedCount
  }

  const markKnownTargets = (): number => {
    if (status.value !== 'playing' || inputLocked.value || !level.value) return 0
    const targets = level.value.cells.filter((cell) => cell.status === 'revealed-target')
    if (targets.length === 0) return 0
    let markedCount = 0
    for (const cell of level.value.cells) {
      if (cell.status === 'hidden' && targets.some((target) => excludedByTarget(cell, target))) {
        setCellStatus(cell, 'flagged')
        markedCount += 1
      }
    }
    return markedCount
  }

  const finishSuccess = (): void => {
    status.value = 'success'
    highestLevel.value = Math.max(highestLevel.value, currentLevelIndex.value + 1)
    persist()
    playFeedback('success')
  }

  const revealCell = async (point: Point): Promise<'target' | 'empty' | 'ignored'> => {
    if (status.value !== 'playing' || inputLocked.value) return 'ignored'
    const cell = findCell(point)
    if (!cell || cell.status !== 'hidden') return 'ignored'
    inputLocked.value = true
    lastAutoMarkedCount.value = 0
    if (cell.hasTarget) {
      setCellStatus(cell, 'revealed-target')
      hintedCellKey.value = null
      lastAutoMarkedCount.value = autoMarkFromTarget(cell)
      autoMarkOrigin.value = lastAutoMarkedCount.value > 0
        ? { row: cell.row, col: cell.col }
        : null
      inputLocked.value = false
      if (remainingTargets.value === 0) finishSuccess()
      else persist()
      return 'target'
    }

    setCellStatus(cell, 'revealed-empty')
    lives.value = Math.max(0, lives.value - 1)
    playFeedback('error')
    await delay(180)
    inputLocked.value = false
    if (lives.value === 0) {
      status.value = 'failed'
    }
    persist()
    return 'empty'
  }

  const useHint = (): string | null => {
    if (status.value !== 'playing' || inputLocked.value || !level.value) return null
    const target = level.value.cells.find((cell) => cell.hasTarget && cell.status === 'hidden')
    hintedCellKey.value = target ? pointKey(target) : null
    if (target) window.setTimeout(() => {
      if (hintedCellKey.value === pointKey(target)) hintedCellKey.value = null
    }, 1500)
    return hintedCellKey.value
  }

  const clearPlayerMarks = (): void => {
    if (!level.value || status.value !== 'playing') return
    for (const cell of level.value.cells) if (cell.status === 'flagged') cell.status = 'hidden'
  }

  const toggleAutoMark = (): void => {
    autoMark.value = !autoMark.value
    persist()
  }

  const toggleTheme = (): void => {
    theme.value = theme.value === 'dark' ? 'light' : theme.value === 'light' ? 'high-contrast' : 'dark'
    applyTheme()
    persist()
  }

  const toggleSound = (): void => {
    soundEnabled.value = !soundEnabled.value
    persist()
  }

  const setIconAsset = (assetId: string): void => {
    if (!ICON_ASSETS.some((asset) => asset.id === assetId)) return
    iconAsset.value = assetId
    persist()
  }

  const setBackgroundAsset = (assetId: string): void => {
    if (!BACKGROUND_ASSETS.some((asset) => asset.id === assetId)) return
    backgroundAsset.value = assetId
    persist()
  }

  const toggleSettings = (): void => {
    settingsPanelOpen.value = !settingsPanelOpen.value
  }

  const resetProgress = (): void => {
    clearProgress()
    highestLevel.value = 0
    currentLevelIndex.value = 0
    persist()
  }

  applyTheme()

  return {
    status,
    currentLevelIndex,
    highestLevel,
    level,
    lives,
    elapsedSeconds,
    inputLocked,
    errorCellKey,
    hintedCellKey,
    lastAutoMarkedCount,
    autoMarkOrigin,
    autoMark,
    soundEnabled,
    theme,
    iconAsset,
    backgroundAsset,
    iconUrl,
    backgroundUrl,
    settingsPanelOpen,
    profile,
    cells,
    targetCount,
    foundCount,
    remainingTargets,
    progressPercent,
    knownTargetMarkableCount,
    startLevel,
    restartLevel,
    nextLevel,
    pause,
    resume,
    goHome,
    tick,
    markCell,
    markKnownTargets,
    revealCell,
    useHint,
    clearPlayerMarks,
    toggleAutoMark,
    toggleTheme,
    toggleSound,
    setIconAsset,
    setBackgroundAsset,
    toggleSettings,
    resetProgress,
  }
})
