import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { login as loginRequest, fetchMe, logout as logoutRequest } from '@/services/auth'
import { UNAUTHORIZED_EVENT } from '@/services/http'
import { getToken, setToken } from '@/lib/token'
import type { AppSettings, AuthUser } from '@/types/auth'

interface AuthContextValue {
  user: AuthUser | null
  permissions: string[]
  settings: AppSettings | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    setToken(null)
    setUser(null)
    setPermissions([])
    setSettings(null)
  }, [])

  const restoreSession = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me.user)
      setPermissions(me.permissions)
      setSettings(me.settings)
    } catch {
      clearSession()
    } finally {
      setIsLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    const handler = () => clearSession()
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password)
    setToken(res.token)
    setUser(res.user)
    setPermissions(res.permissions)
    setSettings(res.settings)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // Even if the server call fails, the local session must be cleared.
    }
    clearSession()
  }, [clearSession])

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      settings,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasPermission,
    }),
    [user, permissions, settings, isLoading, login, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}