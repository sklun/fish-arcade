const ANONYMOUS_USER_KEY = 'fish:anonymous-id:v1'

const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export const getAnonymousUserId = (): string => {
    if (typeof window === 'undefined') return ''
    try {
        const existing = window.localStorage.getItem(ANONYMOUS_USER_KEY)?.trim()
        if (existing) return existing
        const id = createId()
        window.localStorage.setItem(ANONYMOUS_USER_KEY, id)
        return id
    } catch {
        return ''
    }
}
