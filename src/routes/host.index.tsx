import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'

export const Route = createFileRoute('/host/')({ component: Dashboard })

function Dashboard() {
  const navigate = useNavigate()
  const { signOut } = useAuthActions()
  const me = useQuery(api.users.currentUser)
  const quizzes = useQuery(api.quizzes.listMyQuizzes)
  const createQuiz = useMutation(api.quizzes.createQuiz)
  const createRoom = useMutation(api.rooms.createRoom)
  const [title, setTitle] = useState('')

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const quizId = await createQuiz({ title })
    setTitle('')
    navigate({ to: '/host/quiz/$quizId', params: { quizId } })
  }

  const onStartRoom = async (quizId: string) => {
    const roomId = await createRoom({ quizId: quizId as any })
    navigate({ to: '/host/room/$roomId', params: { roomId } })
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your quizzes</h1>
          {me?.email && (
            <p className="text-sm text-muted-foreground">{me.email}</p>
          )}
        </div>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex gap-3">
            <Input
              placeholder="Quiz title, e.g. Geography Night"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {quizzes === undefined && (
          <p className="text-muted-foreground">Loading quizzes…</p>
        )}
        {quizzes?.length === 0 && (
          <p className="text-muted-foreground">
            No quizzes yet — create your first one above.
          </p>
        )}
        {quizzes?.map((quiz) => (
          <Card key={quiz._id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{quiz.title}</p>
                <p className="text-sm text-muted-foreground">
                  {quiz.questionCount} question
                  {quiz.questionCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/host/quiz/$quizId"
                  params={{ quizId: quiz._id }}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Edit
                </Link>
                <Button
                  size="sm"
                  disabled={quiz.questionCount === 0}
                  onClick={() => onStartRoom(quiz._id)}
                >
                  Start room
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
