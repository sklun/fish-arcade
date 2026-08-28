import {describe, expect, it} from 'vitest'

import {getLevelProfile, isHardLevel, seedForLevel} from '@/game/progression'

describe('progression', () => {
    it('uses a strict four-normal-one-hard sequence', () => {
        expect(Array.from({length: 10}, (_, index) => isHardLevel(index))).toEqual([
            false, false, false, false, true,
            false, false, false, false, true,
        ])
    })

    it('keeps the reference board parameters across the difficulty cycle', () => {
        const normal = getLevelProfile(3)
        const hard = getLevelProfile(4)
        expect(hard.lives).toBe(2)
        expect(normal.rows).toBeGreaterThanOrEqual(25)
        expect(normal.rows).toBeLessThanOrEqual(35)
        expect(normal.cols).toBeGreaterThanOrEqual(25)
        expect(normal.cols).toBeLessThanOrEqual(35)
        expect(hard.rows).toBe(40)
        expect(hard.cols).toBe(40)
        expect(normal.arrowCount).toBe(100)
        expect(hard.arrowCount).toBe(100)
    })

    it('derives stable, distinct seeds from level indices', () => {
        expect(seedForLevel(2)).toBe(seedForLevel(2))
        expect(seedForLevel(2)).not.toBe(seedForLevel(3))
    })
})
