const ANONYMOUS_USER_KEY = 'fish:anonymous-id:v1'

const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Returns a stable browser-instance identifier; it is not an account identity. */
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

export const clearAnonymousUserId = (): void => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(ANONYMOUS_USER_KEY)
    } catch {
        // Storage may be unavailable in private browsing.
    }
}
