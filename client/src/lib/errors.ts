import { ApiError } from '@/services/http'

const FRIENDLY: Record<string, string> = {
  DATABASE_UNAVAILABLE:
    "We couldn't complete that operation right now. The system is temporarily unavailable — please try again.",
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_TOKEN: 'Your session is no longer valid. Please sign in again.',
  FORBIDDEN: "You don't have permission to perform that action.",
  NOT_FOUND: 'The requested record was not found or you do not have access to it.',
  CONFLICT: 'That change conflicts with existing data. Please refresh and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
}

/**
 * Maps backend error codes (Stage 9.4 classification) to user-friendly copy.
 * Falls back to the server-provided message, which is already human-readable
 * for validation errors and business-rule rejections.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code) {
    return FRIENDLY[err.code] ?? err.message
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}

/** Convenience wrapper for pages that surface errors via sonner toasts. */
export function toastErrorMessage(err: unknown): string {
  return getErrorMessage(err)
}