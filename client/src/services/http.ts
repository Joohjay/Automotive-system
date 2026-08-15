import { getToken as getStoredToken } from '@/lib/token'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

interface ErrorPayload {
  error?: {
    message?: string
    code?: string
    details?: unknown
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const UNAUTHORIZED_EVENT = 'autoparts:unauthorized'

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getStoredToken()
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    credentials: 'include',
    ...init,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // Non-JSON response; handled by the status check below.
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  if (!response.ok) {
    const errorBody = payload as ErrorPayload | null
    throw new ApiError(
      response.status,
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.code,
      errorBody?.error?.details,
    )
  }

  return payload as T
}