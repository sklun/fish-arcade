import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useGameStore } from '@/app/stores/game'

describe('aemeath game store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('marks and unmarks a hidden cell without spending a life', () => {
    const store = useGameStore()
    expect(store.autoMark).toBe(false)
    store.startLevel(0)
    const cell = store.cells[0]
    expect(cell).toBeDefined()
    if (!cell) return
    store.markCell(cell)
    expect(store.cells[0]?.status).toBe('flagged')
    expect(store.lives).toBe(3)
    store.markCell(cell)
    expect(store.cells[0]?.status).toBe('hidden')
  })

  it('reveals an empty cell and spends exactly one life', async () => {
    const store = useAemeathStoreForTest()
    const empty = store.cells.find((cell) => !cell.hasTarget)
    expect(empty).toBeDefined()
    if (!empty) return
    const result = store.revealCell(empty)
    await vi.runAllTimersAsync()
    expect(await result).toBe('empty')
    expect(store.lives).toBe(2)
    expect(empty.status).toBe('revealed-empty')
  })

  it('tracks elapsed play time without imposing a time limit', () => {
    const store = useAemeathStoreForTest()

    store.tick(86_400)
    expect(store.elapsedSeconds).toBe(86_400)
    expect(store.status).toBe('playing')

    store.pause()
    store.tick(60)
    expect(store.elapsedSeconds).toBe(86_400)
    expect(store.status).toBe('paused')
  })

  it('auto-marks every hidden cell immediately after finding a target', async () => {
    const store = useAemeathStoreForTest()
    store.toggleAutoMark()
    const target = store.cells.find((cell) => cell.hasTarget)
    expect(target).toBeDefined()
    if (!target) return
    const excludedCells = store.cells.filter((cell) =>
      cell !== target && (
        cell.regionId === target.regionId ||
        cell.row === target.row ||
        cell.col === target.col ||
        (Math.abs(cell.row - target.row) <= 1 && Math.abs(cell.col - target.col) <= 1)
      ),
    )
    const playerMarkedCell = excludedCells[0]
    expect(playerMarkedCell).toBeDefined()
    if (!playerMarkedCell) return
    store.markCell(playerMarkedCell)

    const result = store.revealCell(target)
    expect(target.status).toBe('revealed-target')
    expect(playerMarkedCell.status).toBe('flagged')
    expect(store.lastAutoMarkedCount).toBe(excludedCells.length - 1)
    expect(store.autoMarkOrigin).toEqual({ row: target.row, col: target.col })
    expect(store.inputLocked).toBe(false)
    expect(excludedCells.filter((cell) => cell !== playerMarkedCell).every((cell) => cell.status === 'auto-flagged')).toBe(true)
    expect(store.cells.filter((cell) =>
      cell !== target && !excludedCells.includes(cell) && cell.status !== 'hidden',
    )).toHaveLength(0)
    expect(await result).toBe('target')
  })

  it('manually marks cells excluded by discovered targets while preserving existing marks', async () => {
    const store = useAemeathStoreForTest()
    const target = store.cells.find((cell) => cell.hasTarget)
    expect(target).toBeDefined()
    if (!target) return

    expect(await store.revealCell(target)).toBe('target')
    const markable = store.cells.filter((cell) =>
      cell.status === 'hidden' && (
        cell.regionId === target.regionId ||
        cell.row === target.row ||
        cell.col === target.col ||
        (Math.abs(cell.row - target.row) <= 1 && Math.abs(cell.col - target.col) <= 1)
      ),
    )
    expect(markable.length).toBeGreaterThan(0)
    expect(store.knownTargetMarkableCount).toBe(markable.length)

    const first = markable[0]
    if (!first) return
    store.markCell(first)
    expect(store.markKnownTargets()).toBe(markable.length - 1)
    expect(first.status).toBe('flagged')
    expect(markable.slice(1).every((cell) => cell.status === 'flagged')).toBe(true)
    expect(store.knownTargetMarkableCount).toBe(0)
  })
})

const useAemeathStoreForTest = () => {
  const store = useGameStore()
  store.startLevel(0)
  return store
}
