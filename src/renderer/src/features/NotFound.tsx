import { useNavigate } from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import { EmptyState, Button } from '../components/ui/primitives'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="grid h-full place-items-center p-8">
      <EmptyState
        icon={Compass}
        title="That page does not exist"
        description="The link may be out of date, or the item was removed from the server."
        action={
          <Button variant="primary" size="sm" onClick={() => navigate({ to: '/' })}>
            Back to home
          </Button>
        }
      />
    </div>
  )
}
