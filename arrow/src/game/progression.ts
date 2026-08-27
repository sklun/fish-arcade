export interface LevelProfile {
    difficulty: 'normal' | 'hard'
    rows: number
    cols: number
    arrowCount: number
    lives: number
    timeLimitSec: number
}

export const isHardLevel = (levelIndex: number): boolean => (levelIndex + 1) % 5 === 0

export const getLevelProfile = (levelIndex: number): LevelProfile => {
    const normalizedIndex = Math.max(0, Math.floor(levelIndex))
    if (isHardLevel(normalizedIndex)) {
        return {
            difficulty: 'hard',
            rows: 40,
            cols: 30,
            arrowCount: 100,
            lives: 2,
            timeLimitSec: 210,
        }
    }

    return {
        difficulty: 'normal',
        rows: 40,
        cols: 30,
        arrowCount: 100,
        lives: 3,
        timeLimitSec: 180,
    }
}

export const seedForLevel = (levelIndex: number): number => {
    let value = (Math.max(0, Math.floor(levelIndex)) + 1) * 0x9e3779b1
    value ^= value >>> 16
    value = Math.imul(value, 0x85ebca6b)
    value ^= value >>> 13
    return value >>> 0
}
