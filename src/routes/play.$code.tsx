import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/play/$code')({ component: Play })

type Identity = { participantId: string; name: string }

function Play() {
  const { code } = Route.useParams()
  const room = useQuery(api.rooms.getRoomByCode, { code })
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Restore identity for this room from localStorage on mount.
  useEffect(() => {
    const stored = localStorage.getItem(`quiz:player:${code}`)
    if (stored) setIdentity(JSON.parse(stored))
    setLoaded(true)
  }, [code])

  if (room === undefined || !loaded)
    return <p className="text-muted-foreground">Loading…</p>
  if (room === null)
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="grid gap-3 py-6 text-center">
          <p>No quiz found for code <span className="font-mono">{code}</span>.</p>
          <Link to="/" className="text-sm underline">
            Back home
          </Link>
        </CardContent>
      </Card>
    )

  if (!identity)
    return (
      <JoinForm
        code={code}
        onJoined={(idn) => {
          localStorage.setItem(`quiz:player:${code}`, JSON.stringify(idn))
          setIdentity(idn)
        }}
      />
    )

  return <Game roomId={room._id} identity={identity} quizTitle={room.quizTitle} />
}

function JoinForm({
  code,
  onJoined,
}: {
  code: string
  onJoined: (idn: Identity) => void
}) {
  const joinRoom = useMutation(api.rooms.joinRoom)
  const [name, setName] = useState(
    () => sessionStorage.getItem('quiz:pendingName') ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  const join = async (n: string) => {
    setError(null)
    try {
      const res = await joinRoom({ code, name: n })
      onJoined({ participantId: res.participantId, name: n })
    } catch {
      setError('Could not join — the room may have ended.')
    }
  }

  // Auto-join if a name was chosen on the landing page.
  useEffect(() => {
    const pending = sessionStorage.getItem('quiz:pendingName')
    if (pending && !attempted.current) {
      attempted.current = true
      sessionStorage.removeItem('quiz:pendingName')
      join(pending)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="grid gap-4 py-6">
        <h1 className="text-xl font-bold">
          Join <span className="font-mono">{code}</span>
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) join(name.trim())
          }}
          className="grid gap-3"
        >
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={!name.trim()}>
            Join
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Game({
  roomId,
  identity,
  quizTitle,
}: {
  roomId: Id<'rooms'>
  identity: Identity
  quizTitle: string
}) {
  const current = useQuery(api.rooms.getCurrentQuestion, { roomId })
  const leaderboard = useQuery(api.rooms.getLeaderboard, { roomId })
  const submitAnswer = useMutation(api.rooms.submitAnswer)

  // Track which choice this player picked for the current question.
  const [picked, setPicked] = useState<{ questionId: string; choice: number } | null>(
    null,
  )

  const me = leaderboard?.find((r) => r._id === identity.participantId)

  if (current === undefined)
    return <p className="text-muted-foreground">Loading…</p>

  const Header = (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{quizTitle}</p>
        <p className="font-medium">{identity.name}</p>
      </div>
      {me && (
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-xl font-bold">{me.score}</p>
        </div>
      )}
    </div>
  )

  if (!current || current.state === 'lobby')
    return (
      <div className="mx-auto max-w-md">
        {Header}
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You're in! Waiting for the host to start…
          </CardContent>
        </Card>
      </div>
    )

  if (current.state === 'ended')
    return (
      <div className="mx-auto max-w-md">
        {Header}
        <Card>
          <CardContent className="grid gap-3 py-6">
            <h2 className="text-center text-xl font-bold">🏁 Quiz over!</h2>
            {me && (
              <p className="text-center text-muted-foreground">
                You finished #{me.rank} with {me.score} points.
              </p>
            )}
            <ol className="grid gap-1">
              {leaderboard?.slice(0, 5).map((r) => (
                <li
                  key={r._id}
                  className={cn(
                    'flex justify-between rounded-md px-3 py-2',
                    r._id === identity.participantId
                      ? 'bg-primary/10 font-medium'
                      : 'bg-muted/40',
                  )}
                >
                  <span>
                    {r.rank}. {r.name}
                  </span>
                  <span>{r.score}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    )

  // question or reveal state with a live question
  const questionId = current.questionId
  const choices = current.choices
  if (!questionId || !choices)
    return <p className="text-muted-foreground">Waiting…</p>

  const answeredThis =
    picked && picked.questionId === questionId ? picked.choice : null
  const revealed = current.state === 'reveal'

  const onPick = async (i: number) => {
    if (answeredThis !== null || revealed) return
    setPicked({ questionId, choice: i })
    try {
      await submitAnswer({
        participantId: identity.participantId as Id<'participants'>,
        questionId: questionId as Id<'questions'>,
        choiceIndex: i,
      })
    } catch {
      // ignore — likely the window closed
    }
  }

  return (
    <div className="mx-auto max-w-md">
      {Header}
      <Card>
        <CardContent className="grid gap-4 py-6">
          <h2 className="text-lg font-semibold">{current.text}</h2>
          <div className="grid gap-2">
            {choices.map((choice, i) => {
              const isPicked = answeredThis === i
              const isCorrect = revealed && current.correctIndex === i
              const isWrongPick = revealed && isPicked && !isCorrect
              return (
                <button
                  key={i}
                  onClick={() => onPick(i)}
                  disabled={answeredThis !== null || revealed}
                  className={cn(
                    'rounded-md border p-4 text-left transition-colors disabled:cursor-default',
                    !revealed && answeredThis === null && 'hover:bg-accent',
                    isPicked && !revealed && 'border-primary bg-primary/10',
                    isCorrect && 'border-green-600 bg-green-600/15',
                    isWrongPick && 'border-destructive bg-destructive/10',
                  )}
                >
                  {isCorrect ? '✓ ' : isWrongPick ? '✗ ' : ''}
                  {choice}
                </button>
              )
            })}
          </div>
          {!revealed && answeredThis !== null && (
            <p className="text-center text-sm text-muted-foreground">
              Answer locked in — waiting for others…
            </p>
          )}
          {revealed && (
            <p className="text-center text-sm text-muted-foreground">
              {answeredThis === current.correctIndex
                ? 'Nice! 🎉'
                : answeredThis !== null
                  ? 'Not this time.'
                  : 'Time up!'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
