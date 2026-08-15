import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pages,
  onPageChange,
  className,
}: {
  page: number
  pages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (pages <= 1) return null
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <p className="text-muted-foreground text-xs">
        Page {page} of {pages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}