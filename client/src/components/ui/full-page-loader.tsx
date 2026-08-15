import { Wrench } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

export function FullPageLoader() {
  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="bg-primary flex size-12 items-center justify-center rounded-xl text-primary-foreground">
        <Wrench className="size-6" />
      </div>
      <div className="flex w-64 flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}