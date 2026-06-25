import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    // Stash the chosen name so the play screen can auto-join.
    sessionStorage.setItem('quiz:pendingName', name.trim())
    navigate({ to: '/play/$code', params: { code: code.trim().toUpperCase() } })
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Join a live quiz</CardTitle>
          <CardDescription>
            Enter the room code your host is showing on screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={join} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                placeholder="ABCDE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-lg tracking-widest"
                maxLength={5}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                placeholder="Ada"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg">
              Join quiz
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Host a quiz</CardTitle>
          <CardDescription>
            Sign in to build quizzes and run live rooms with a real-time
            leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Powered by Convex: every screen updates live as players join and
            answer — no refresh, no polling.
          </p>
          <Link to="/host" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Go to host dashboard →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
