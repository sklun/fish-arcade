import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGameStore } from '@/app/stores/game'
import type { Arrow, Level } from '@/game/model'

const makeArrow = (id: string, row: number, col: number, direction: Arrow['direction']): Arrow => ({
  id,
  color: '#fff',
  cells: [{ row, col }],
  direction,
  head: { row, col },
  alive: true,
  highlighted: false,
})

const makeLevel = (arrows: Arrow[]): Level => ({
  id: 'store-test',
  difficulty: 'normal',
  rows: 5,
  cols: 5,
  arrows,
  timeLimitSec: 30,
  seed: 1,
})

describe('game store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('pauses and resumes the countdown without duplicate settlement', () => {
    const store = useGameStore()
    store.$patch({ status: 'playing', timeRemaining: 2 })
    store.tick()
    store.pause()
    store.tick()
    expect(store.timeRemaining).toBe(1)
    store.resume()
    store.tick()
    store.tick()
    expect(store.timeRemaining).toBe(0)
    expect(store.status).toBe('failed')
    expect(store.failureReason).toBe('time')
  })

  it('removes one life and restores state after a collision', async () => {
    const store = useGameStore()
    const moving = makeArrow('moving', 2, 2, 'right')
    const blocker = makeArrow('blocker', 2, 3, 'up')
    store.$patch({ status: 'playing', lives: 3, level: makeLevel([moving, blocker]) })

    const attempt = store.attemptArrow('moving')
    expect(store.lives).toBe(2)
    await vi.advanceTimersByTimeAsync(240)

    await expect(attempt).resolves.toBe('collision')
    expect(store.level?.arrows.find((arrow) => arrow.id === 'moving')?.alive).toBe(true)
    expect(store.inputLocked).toBe(false)
  })

  it('removes a successful arrow and completes the level', async () => {
    const store = useGameStore()
    const moving = makeArrow('moving', 0, 0, 'up')
    store.$patch({ status: 'playing', lives: 3, timeRemaining: 20, level: makeLevel([moving]) })

    const attempt = store.attemptArrow('moving')
    await vi.advanceTimersByTimeAsync(320)

    await expect(attempt).resolves.toBe('exit')
    expect(store.aliveCount).toBe(0)
    expect(store.status).toBe('success')
  })

  it('highlights a movable arrow without changing lives', () => {
    const store = useGameStore()
    const moving = makeArrow('moving', 0, 0, 'up')
    store.$patch({ status: 'playing', lives: 3, level: makeLevel([moving]) })

    expect(store.useHint()).toBe('moving')
    expect(store.lives).toBe(3)
    expect(store.hintsRemaining).toBe(2)
    expect(store.level?.arrows[0]?.highlighted).toBe(true)
  })
})
