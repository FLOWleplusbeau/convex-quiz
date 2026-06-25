import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/login')({ component: Login })

function Login() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const formData = new FormData(e.currentTarget)
    formData.set('flow', flow)
    try {
      await signIn('password', formData)
      navigate({ to: '/host' })
    } catch (err) {
      setError(
        flow === 'signIn'
          ? 'Could not sign in. Check your email and password.'
          : 'Could not sign up. The email may already be registered.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{flow === 'signIn' ? 'Host sign in' : 'Create host account'}</CardTitle>
          <CardDescription>
            Hosts need an account to build quizzes and run rooms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? '…' : flow === 'signIn' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setFlow(flow === 'signIn' ? 'signUp' : 'signIn')
            }}
            className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {flow === 'signIn'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
