import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/host/quiz/$quizId')({
  component: QuizEditor,
})

const EMPTY = ['', '', '', '']

function QuizEditor() {
  const { quizId } = Route.useParams()
  const data = useQuery(api.quizzes.getQuizWithQuestions, {
    quizId: quizId as Id<'quizzes'>,
  })
  const addQuestion = useMutation(api.quizzes.addQuestion)
  const deleteQuestion = useMutation(api.quizzes.deleteQuestion)

  const [text, setText] = useState('')
  const [choices, setChoices] = useState<string[]>(EMPTY)
  const [correctIndex, setCorrectIndex] = useState(0)
  const [timeLimitSec, setTimeLimitSec] = useState(20)

  if (data === undefined) return <p className="text-muted-foreground">Loading…</p>
  if (data === null)
    return (
      <p className="text-muted-foreground">
        Quiz not found.{' '}
        <Link to="/host" className="underline">
          Back to dashboard
        </Link>
      </p>
    )

  const { quiz, questions } = data
  const filledChoices = choices.filter((c) => c.trim())
  const canAdd = text.trim() && filledChoices.length >= 2 && choices[correctIndex]?.trim()

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    // Keep only non-empty choices, remapping the correct index.
    const kept: string[] = []
    let newCorrect = 0
    choices.forEach((c, i) => {
      if (c.trim()) {
        if (i === correctIndex) newCorrect = kept.length
        kept.push(c.trim())
      }
    })
    await addQuestion({
      quizId: quiz._id,
      text,
      choices: kept,
      correctIndex: newCorrect,
      timeLimitSec,
    })
    setText('')
    setChoices(EMPTY)
    setCorrectIndex(0)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/host" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="qtext">Question</Label>
              <Input
                id="qtext"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What is the capital of France?"
              />
            </div>
            <div className="grid gap-2">
              <Label>Choices (pick the correct one)</Label>
              {choices.map((c, i) => (
                <label
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-2',
                    correctIndex === i && 'border-primary bg-primary/5',
                  )}
                >
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                  />
                  <Input
                    value={c}
                    onChange={(e) => {
                      const next = [...choices]
                      next[i] = e.target.value
                      setChoices(next)
                    }}
                    placeholder={`Choice ${i + 1}`}
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-2 max-w-[200px]">
              <Label htmlFor="time">Time limit (seconds)</Label>
              <Input
                id="time"
                type="number"
                min={5}
                max={120}
                value={timeLimitSec}
                onChange={(e) => setTimeLimitSec(Number(e.target.value))}
              />
            </div>
            <Button type="submit" disabled={!canAdd}>
              Add question
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">
          Questions ({questions.length})
        </h2>
        {questions.length === 0 && (
          <p className="text-muted-foreground">
            No questions yet. Add at least one to run a room.
          </p>
        )}
        {questions.map((q, i) => (
          <Card key={q._id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {i + 1}. {q.text}
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {q.choices.map((c, ci) => (
                      <li
                        key={ci}
                        className={cn(
                          ci === q.correctIndex
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {ci === q.correctIndex ? '✓ ' : '• '}
                        {c}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {q.timeLimitSec}s
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteQuestion({ questionId: q._id })}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {questions.length > 0 && (
        <Link to="/host" className={buttonVariants({ size: 'lg' })}>
          Done — back to dashboard to start a room
        </Link>
      )}
    </div>
  )
}
