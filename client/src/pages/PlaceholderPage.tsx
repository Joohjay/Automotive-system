import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={ArrowLeft}
        title="Module coming soon"
        description="This module is scheduled for a future development stage. You can return to the dashboard for now."
        action={
          <Button asChild size="sm">
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
