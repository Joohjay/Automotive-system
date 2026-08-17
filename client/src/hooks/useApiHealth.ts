import { useEffect, useRef, useState } from 'react'

import { getHealth } from '@/services/health'
import type { HealthResponse } from '@/types/health'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string }

let sharedState: HealthState = { status: 'loading' }
let sharedListeners = new Set<() => void>()
let sharedTimer: ReturnType<typeof setInterval> | null = null

function notify() {
  for (const fn of sharedListeners) fn()
}

function startPolling(intervalMs: number) {
  if (sharedTimer !== null) return
  const check = async () => {
    try {
      const data = await getHealth()
      sharedState = { status: 'ok', data }
    } catch (err) {
      sharedState = {
        status: 'error',
        message: err instanceof Error ? err.message : 'API unreachable',
      }
    }
    notify()
  }
  void check()
  sharedTimer = setInterval(() => void check(), intervalMs)
}

function stopPolling() {
  if (sharedTimer !== null) {
    clearInterval(sharedTimer)
    sharedTimer = null
  }
}

export function useApiHealth(intervalMs = 30_000): HealthState {
  const [, setTick] = useState(0)
  const listenerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const listener = () => setTick((n) => n + 1)
    listenerRef.current = listener
    sharedListeners.add(listener)
    startPolling(intervalMs)

    return () => {
      if (listenerRef.current) sharedListeners.delete(listenerRef.current)
      if (sharedListeners.size === 0) stopPolling()
    }
  }, [intervalMs])

  return sharedState
}
