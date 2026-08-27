const STORAGE_KEY = 'arrow.progress.v1'

export interface SavedProgress {
    highestLevel: number
    theme: 'dark' | 'light'
    soundEnabled: boolean
}

const DEFAULT_PROGRESS: SavedProgress = {
    highestLevel: 0,
    theme: 'dark',
    soundEnabled: true,
}

export const loadProgress = (): SavedProgress => {
    if (typeof localStorage === 'undefined') return {...DEFAULT_PROGRESS}
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<SavedProgress>
        return {
            highestLevel:
                typeof stored.highestLevel === 'number' ? Math.max(0, Math.floor(stored.highestLevel)) : 0,
            theme: stored.theme === 'light' ? 'light' : 'dark',
            soundEnabled: stored.soundEnabled !== false,
        }
    } catch {
        return {...DEFAULT_PROGRESS}
    }
}

export const saveProgress = (progress: SavedProgress): void => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}
