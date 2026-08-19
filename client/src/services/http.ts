import { ensureCsrfToken, resetCsrfToken } from '@/lib/csrf'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

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

async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  if (UNSAFE_METHODS.has(method)) {
    const csrf = await ensureCsrfToken()
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await doFetch(path, init)
  const method = (init.method ?? 'GET').toUpperCase()

  // A stale in-memory CSRF token (cookie cleared/re-issued) can cause a 403;
  // re-bootstrap once and retry before surfacing the error.
  if (response.status === 403 && UNSAFE_METHODS.has(method)) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      // ignore
    }
    const code = (payload as ErrorPayload | null)?.error?.code
    if (code === 'CSRF_TOKEN_INVALID') {
      resetCsrfToken()
      response = await doFetch(path, init)
    }
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Non-JSON response; handled by the status check below.
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  if (!response.ok) {
    const errorBody = body as ErrorPayload | null
    throw new ApiError(
      response.status,
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.code,
      errorBody?.error?.details,
    )
  }

  return body as T
}