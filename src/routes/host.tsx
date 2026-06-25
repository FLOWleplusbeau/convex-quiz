import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/host')({ component: HostLayout })

// Auth gate for every /host/* route. Renders child routes via <Outlet /> once
// the host is authenticated.
function HostLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!isAuthenticated)
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Sign in to host</CardTitle>
          <CardDescription>
            You need a host account to create quizzes and run live rooms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants({})}>
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    )

  return <Outlet />
}
