import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 pointer-events-none block size-4 rounded-full ring-0 transition-transform',
        )}
      />
    </SwitchPrimitives.Root>
  )
}

export { Switch }