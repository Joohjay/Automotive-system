import { Outlet } from 'react-router-dom'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
