import type {Difficulty} from '@/game/model'

export type LevelProfile = {
    difficulty: Difficulty
    rows: number
    cols: number
    regions: number
    lives: number
}

export const getLevelProfile = (levelIndex: number): LevelProfile => {
    const safeIndex = Math.max(0, Math.floor(levelIndex))
    const cyclePosition = safeIndex % 5
    const cycle = Math.floor(safeIndex / 5)
    if (cyclePosition === 4) {
        const size = Math.min(14, 10 + cycle)
        return {
            difficulty: 'hard',
            rows: size,
            cols: size,
            regions: Math.min(size, 10 + cycle),
            lives: 3,
        }
    }

    const size = Math.min(11, 8 + Math.floor(cyclePosition / 2))
    return {
        difficulty: 'normal',
        rows: size,
        cols: size,
        regions: size,
        lives: 3,
    }
}

export const isHardLevel = (levelIndex: number): boolean => getLevelProfile(levelIndex).difficulty === 'hard'
