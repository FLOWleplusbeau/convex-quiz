import { createFileRoute, Link } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/host/room/$roomId')({
  component: HostRoom,
})

function HostRoom() {
  const { roomId } = Route.useParams()
  const id = roomId as Id<'rooms'>
  const { isLoading, isAuthenticated } = useConvexAuth()
  const room = useQuery(api.rooms.getRoom, { roomId: id })
  const participants = useQuery(api.rooms.listParticipants, { roomId: id })
  const leaderboard = useQuery(api.rooms.getLeaderboard, { roomId: id })
  const current = useQuery(api.rooms.getCurrentQuestion, { roomId: id })
  const results = useQuery(api.rooms.getLiveResults, { roomId: id })

  const startQuiz = useMutation(api.rooms.startQuiz)
  const nextQuestion = useMutation(api.rooms.nextQuestion)
  const revealNow = useMutation(api.rooms.revealNow)

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!isAuthenticated)
    return (
      <p className="text-muted-foreground">
        <Link to="/login" className="underline">
          Sign in
        </Link>{' '}
        to control this room.
      </p>
    )
  if (room === undefined) return <p className="text-muted-foreground">Loading…</p>
  if (room === null) return <p className="text-muted-foreground">Room not found.</p>

  const isLast = room.currentIndex >= room.totalQuestions - 1

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/host" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{room.quizTitle}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Join code
          </p>
          <p className="font-mono text-3xl font-bold tracking-widest">
            {room.code}
          </p>
        </div>
      </div>

      {room.state === 'lobby' && (
        <Card>
          <CardContent className="grid gap-4 py-6">
            <p className="text-muted-foreground">
              Players join at <span className="font-medium">/play/{room.code}</span>.
              This list updates live.
            </p>
            <PlayerChips participants={participants} />
            <Button
              size="lg"
              disabled={!participants || participants.length === 0}
              onClick={() => startQuiz({ roomId: id })}
            >
              Start quiz ({participants?.length ?? 0} player
              {participants?.length === 1 ? '' : 's'})
            </Button>
          </CardContent>
        </Card>
      )}

      {(room.state === 'question' || room.state === 'reveal') &&
        current &&
        current.choices && (
          <Card>
            <CardContent className="grid gap-4 py-6">
              <p className="text-sm text-muted-foreground">
                Question {room.currentIndex + 1} of {room.totalQuestions}
                {room.state === 'reveal' && ' · revealed'}
              </p>
              <h2 className="text-xl font-semibold">{current.text}</h2>
              <div className="grid gap-2">
                {current.choices.map((choice, i) => {
                  const count = results?.counts[i] ?? 0
                  const total = results?.totalAnswers ?? 0
                  const pct = total ? Math.round((count / total) * 100) : 0
                  const isCorrect =
                    room.state === 'reveal' && results?.correctIndex === i
                  return (
                    <div
                      key={i}
                      className={cn(
                        'relative overflow-hidden rounded-md border p-3',
                        isCorrect && 'border-primary',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 transition-all',
                          isCorrect ? 'bg-primary/20' : 'bg-muted',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex justify-between">
                        <span className={cn(isCorrect && 'font-semibold')}>
                          {isCorrect ? '✓ ' : ''}
                          {choice}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {results?.totalAnswers ?? 0} / {participants?.length ?? 0}{' '}
                answered
              </p>
              <div className="flex gap-2">
                {room.state === 'question' && (
                  <Button variant="outline" onClick={() => revealNow({ roomId: id })}>
                    Reveal answer
                  </Button>
                )}
                {room.state === 'reveal' && !isLast && (
                  <Button onClick={() => nextQuestion({ roomId: id })}>
                    Next question →
                  </Button>
                )}
                {room.state === 'reveal' && isLast && (
                  <Button onClick={() => nextQuestion({ roomId: id })}>
                    Finish & show results
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {room.state === 'ended' && (
        <Card>
          <CardContent className="grid gap-2 py-6">
            <h2 className="text-xl font-semibold">🏆 Final results</h2>
            <Leaderboard rows={leaderboard} />
            <Link to="/host" className={cn(buttonVariants({}), 'mt-4 w-fit')}>
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      )}

      {room.state !== 'ended' && room.state !== 'lobby' && (
        <Card>
          <CardContent className="grid gap-2 py-6">
            <h3 className="font-semibold">Leaderboard</h3>
            <Leaderboard rows={leaderboard} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PlayerChips({
  participants,
}: {
  participants: Array<{ _id: string; name: string }> | undefined
}) {
  if (!participants || participants.length === 0)
    return <p className="text-muted-foreground">Waiting for players…</p>
  return (
    <div className="flex flex-wrap gap-2">
      {participants.map((p) => (
        <span
          key={p._id}
          className="rounded-full border bg-secondary px-3 py-1 text-sm"
        >
          {p.name}
        </span>
      ))}
    </div>
  )
}

function Leaderboard({
  rows,
}: {
  rows: Array<{ _id: string; name: string; score: number; rank: number }> | undefined
}) {
  if (!rows || rows.length === 0)
    return <p className="text-muted-foreground">No players yet.</p>
  return (
    <ol className="grid gap-1">
      {rows.map((r) => (
        <li
          key={r._id}
          className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
        >
          <span>
            <span className="mr-2 font-mono text-muted-foreground">
              {r.rank}.
            </span>
            {r.name}
          </span>
          <span className="font-semibold">{r.score}</span>
        </li>
      ))}
    </ol>
  )
}
