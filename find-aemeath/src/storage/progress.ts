export type SavedProgress = {
    highestLevel: number
    currentLevel: number
    autoMark: boolean
    sound: boolean
    theme: 'dark' | 'light' | 'high-contrast'
    iconAsset: string
    backgroundAsset: string
}

const STORAGE_KEY = 'find-aemeath:v1:progress'

const defaults: SavedProgress = {
    highestLevel: 0,
    currentLevel: 0,
    autoMark: false,
    sound: true,
    theme: 'dark',
    iconAsset: 'default',
    backgroundAsset: 'default',
}

export const loadProgress = (): SavedProgress => {
    if (typeof window === 'undefined') return {...defaults}
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
        if (!parsed || typeof parsed !== 'object') return {...defaults}
        const saved = parsed as Partial<SavedProgress>
        return {
            ...defaults,
            ...saved,
            highestLevel: Math.max(0, Number(saved.highestLevel) || 0),
            currentLevel: Math.max(0, Number(saved.currentLevel) || 0),
            autoMark: saved.autoMark === true,
            sound: saved.sound !== false,
        }
    } catch {
        return {...defaults}
    }
}

export const saveProgress = (progress: SavedProgress): void => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
        // Storage can be unavailable in private browsing; the game remains playable.
    }
}

export const clearProgress = (): void => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}
