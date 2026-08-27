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
        expect(normal.rows).toBe(40)
        expect(normal.cols).toBe(30)
        expect(hard.rows).toBe(normal.rows)
        expect(hard.cols).toBe(normal.cols)
        expect(normal.arrowCount).toBe(100)
        expect(hard.arrowCount).toBe(100)
    })

    it('derives stable, distinct seeds from level indices', () => {
        expect(seedForLevel(2)).toBe(seedForLevel(2))
        expect(seedForLevel(2)).not.toBe(seedForLevel(3))
    })
})
