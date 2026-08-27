import type {GameId} from './games'

export interface GameProgress {
    completedLevels: number
    highestUnlockedLevel: number
}

const STORAGE_KEYS: Record<GameId, string> = {
    arrow: 'arrow.progress.v1',
    'find-aemeath': 'find-aemeath:v1:progress',
}

const asLevelIndex = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(9_999, Math.floor(value)))
        : 0

export const readGameProgress = (gameId: GameId): GameProgress => {
    if (typeof window === 'undefined') {
        return {completedLevels: 0, highestUnlockedLevel: 0}
    }

    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS[gameId]) ?? '{}') as {
            highestLevel?: unknown
        }
        const completedLevels = asLevelIndex(stored.highestLevel)
        return {
            completedLevels,
            highestUnlockedLevel: completedLevels,
        }
    } catch {
        return {completedLevels: 0, highestUnlockedLevel: 0}
    }
}

export const createLevelHref = (playHref: string, levelIndex: number): string => {
    const params = new URLSearchParams({level: String(asLevelIndex(levelIndex))})
    return `${playHref}?${params.toString()}`
}
