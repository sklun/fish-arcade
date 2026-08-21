import { describe, expect, it } from 'vitest'

import { getLevelProfile, isHardLevel, seedForLevel } from '@/game/progression'

describe('progression', () => {
  it('uses a strict four-normal-one-hard sequence', () => {
    expect(Array.from({ length: 10 }, (_, index) => isHardLevel(index))).toEqual([
      false, false, false, false, true,
      false, false, false, false, true,
    ])
  })

  it('gives hard levels fewer lives and a larger board', () => {
    const normal = getLevelProfile(3)
    const hard = getLevelProfile(4)
    expect(hard.lives).toBe(2)
    expect(hard.rows * hard.cols).toBeGreaterThan(normal.rows * normal.cols)
  })

  it('derives stable, distinct seeds from level indices', () => {
    expect(seedForLevel(2)).toBe(seedForLevel(2))
    expect(seedForLevel(2)).not.toBe(seedForLevel(3))
  })
})
