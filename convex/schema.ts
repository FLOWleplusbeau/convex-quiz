import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

// Live quiz domain. `authTables` adds the `users`, `authSessions`, etc. tables
// used by Convex Auth (password sign-in for hosts).
export default defineSchema({
  ...authTables,

  // A quiz authored by a host. Reused across many live rooms.
  quizzes: defineTable({
    title: v.string(),
    hostId: v.id('users'),
    createdAt: v.number(),
  }).index('by_host', ['hostId']),

  // Questions belonging to a quiz. `order` is 0-based.
  questions: defineTable({
    quizId: v.id('quizzes'),
    order: v.number(),
    text: v.string(),
    choices: v.array(v.string()),
    correctIndex: v.number(),
    timeLimitSec: v.number(),
  }).index('by_quiz', ['quizId']),

  // A live play session of a quiz, joined via a short `code`.
  rooms: defineTable({
    quizId: v.id('quizzes'),
    hostId: v.id('users'),
    code: v.string(),
    state: v.union(
      v.literal('lobby'),
      v.literal('question'),
      v.literal('reveal'),
      v.literal('ended'),
    ),
    currentIndex: v.number(),
    questionStartedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_host', ['hostId']),

  // A guest player inside a room. `secret` is an unguessable token returned only
  // to the joiner and required to submit answers (prevents acting as another
  // player, since participant ids are visible in the leaderboard).
  participants: defineTable({
    roomId: v.id('rooms'),
    name: v.string(),
    score: v.number(),
    joinedAt: v.number(),
    secret: v.optional(v.string()),
  }).index('by_room', ['roomId']),

  // One answer per participant per question.
  answers: defineTable({
    roomId: v.id('rooms'),
    questionId: v.id('questions'),
    participantId: v.id('participants'),
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    answeredAt: v.number(),
  })
    .index('by_room_question', ['roomId', 'questionId'])
    .index('by_participant_question', ['participantId', 'questionId']),
})
