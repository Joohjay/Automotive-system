import { useEffect, useState } from 'react'

import { getHealth } from '@/services/health'
import type { HealthResponse } from '@/types/health'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string }

export function useApiHealth(intervalMs = 15_000): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const data = await getHealth()
        if (!cancelled) setState({ status: 'ok', data })
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'API unreachable',
          })
        }
      }
    }

    void check()
    const timer = setInterval(() => void check(), intervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [intervalMs])

  return state
}
