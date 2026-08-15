import { useLocation } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { primaryNav, upcomingModules } from '@/config/navigation'

export function ComingSoonPage() {
  const location = useLocation()
  const allItems = [...primaryNav, ...upcomingModules]
  const item = allItems.find((nav) => nav.href === location.pathname)

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">{item?.label ?? 'Module'}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {item?.description ?? 'This module is under construction.'}
        </p>
        <p className="text-xs text-muted-foreground">
          It will be delivered in a later development stage.
        </p>
      </CardContent>
    </Card>
  )
}
