const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4100/api'

let csrfToken: string | null = null

/**
 * Bootstraps the double-submit CSRF token from the API. The server sets the
 * `autoparts_csrf` cookie on this endpoint; the returned token is echoed back in
 * the X-CSRF-Token header on state-changing requests. Cached in memory for the
 * life of the tab (the cookie itself lasts 8h).
 */
export async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  try {
    const res = await fetch(`${API_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { csrfToken?: string }
    csrfToken = body.csrfToken ?? null
    return csrfToken
  } catch {
    return null
  }
}

export function getCsrfToken(): string | null {
  return csrfToken
}

export function resetCsrfToken(): void {
  csrfToken = null
}