import { mutation, query, internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { getAuthUserId } from '@convex-dev/auth/server'
import type { Doc, Id } from './_generated/dataModel'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars

function randomCode() {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

// Look up a question by its position within a quiz.
async function getQuestionAt(
  ctx: MutationCtx | any,
  quizId: Id<'quizzes'>,
  index: number,
): Promise<Doc<'questions'> | null> {
  const questions = await ctx.db
    .query('questions')
    .withIndex('by_quiz', (q: any) => q.eq('quizId', quizId))
    .collect()
  return questions.find((q: Doc<'questions'>) => q.order === index) ?? null
}

// Move a room into "question" state for the given index and schedule the
// automatic reveal once the question's time limit elapses.
async function enterQuestion(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  index: number,
) {
  const question = await getQuestionAt(ctx, room.quizId, index)
  if (!question) {
    await ctx.db.patch(room._id, { state: 'ended' })
    return
  }
  await ctx.db.patch(room._id, {
    state: 'question',
    currentIndex: index,
    questionStartedAt: Date.now(),
  })
  // Scheduled function: auto-reveal when the timer runs out. This is a core
  // Convex feature — durable server-side scheduling, no external cron needed.
  await ctx.scheduler.runAfter(
    question.timeLimitSec * 1000,
    internal.rooms.revealQuestion,
    { roomId: room._id, index },
  )
}

async function requireRoomHost(ctx: MutationCtx, roomId: Id<'rooms'>) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error('Not signed in')
  const room = await ctx.db.get(roomId)
  if (!room) throw new Error('Room not found')
  if (room.hostId !== userId) throw new Error('Not the host')
  return room
}

export const createRoom = mutation({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not signed in')
    const quiz = await ctx.db.get(quizId)
    if (!quiz || quiz.hostId !== userId) throw new Error('Quiz not found')

    // Generate a unique join code.
    let code = randomCode()
    for (let i = 0; i < 10; i++) {
      const clash = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q) => q.eq('code', code))
        .first()
      if (!clash) break
      code = randomCode()
    }

    return await ctx.db.insert('rooms', {
      quizId,
      hostId: userId,
      code,
      state: 'lobby',
      currentIndex: 0,
      createdAt: Date.now(),
    })
  },
})

export const startQuiz = mutation({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await requireRoomHost(ctx, roomId)
    await enterQuestion(ctx, room, 0)
  },
})

export const nextQuestion = mutation({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await requireRoomHost(ctx, roomId)
    await enterQuestion(ctx, room, room.currentIndex + 1)
  },
})

// Host can reveal early instead of waiting for the timer.
export const revealNow = mutation({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await requireRoomHost(ctx, roomId)
    if (room.state === 'question') {
      await ctx.db.patch(room._id, { state: 'reveal' })
    }
  },
})

// Scheduled (and internal): flip to reveal, but only if the room is still on
// the same question — the host may have already advanced manually.
export const revealQuestion = internalMutation({
  args: { roomId: v.id('rooms'), index: v.number() },
  handler: async (ctx, { roomId, index }) => {
    const room = await ctx.db.get(roomId)
    if (!room) return
    if (room.state === 'question' && room.currentIndex === index) {
      await ctx.db.patch(roomId, { state: 'reveal' })
    }
  },
})

export const joinRoom = mutation({
  args: { code: v.string(), name: v.string() },
  handler: async (ctx, { code, name }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first()
    if (!room) throw new Error('No room with that code')
    if (room.state === 'ended') throw new Error('This quiz has ended')

    const participantId = await ctx.db.insert('participants', {
      roomId: room._id,
      name: name.trim().slice(0, 24) || 'Player',
      score: 0,
      joinedAt: Date.now(),
    })
    return { participantId, roomId: room._id }
  },
})

export const submitAnswer = mutation({
  args: {
    participantId: v.id('participants'),
    questionId: v.id('questions'),
    choiceIndex: v.number(),
  },
  handler: async (ctx, { participantId, questionId, choiceIndex }) => {
    const participant = await ctx.db.get(participantId)
    if (!participant) throw new Error('Unknown player')
    const room = await ctx.db.get(participant.roomId)
    if (!room || room.state !== 'question') throw new Error('Not accepting answers')

    const question = await ctx.db.get(questionId)
    if (!question) throw new Error('Unknown question')
    // Must be the question currently being asked.
    if (question.order !== room.currentIndex) throw new Error('Stale question')

    // One answer per participant per question.
    const prior = await ctx.db
      .query('answers')
      .withIndex('by_participant_question', (q) =>
        q.eq('participantId', participantId).eq('questionId', questionId),
      )
      .first()
    if (prior) return { alreadyAnswered: true }

    const isCorrect = choiceIndex === question.correctIndex

    // Faster correct answers earn more — classic quiz scoring.
    let points = 0
    if (isCorrect) {
      const elapsed = Date.now() - (room.questionStartedAt ?? Date.now())
      const limit = question.timeLimitSec * 1000
      const speedBonus = Math.max(0, 1 - elapsed / limit)
      points = Math.round(500 + 500 * speedBonus)
    }

    await ctx.db.insert('answers', {
      roomId: room._id,
      questionId,
      participantId,
      choiceIndex,
      isCorrect,
      answeredAt: Date.now(),
    })
    if (points > 0) {
      await ctx.db.patch(participantId, { score: participant.score + points })
    }
    return { isCorrect, points }
  },
})

// ---- Live (reactive) queries ----

export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first()
    if (!room) return null
    const quiz = await ctx.db.get(room.quizId)
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', room.quizId))
      .collect()
    return {
      _id: room._id,
      code: room.code,
      state: room.state,
      currentIndex: room.currentIndex,
      quizTitle: quiz?.title ?? 'Quiz',
      totalQuestions: questions.length,
    }
  },
})

// Room summary by id (used by the host control screen).
export const getRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId)
    if (!room) return null
    const quiz = await ctx.db.get(room.quizId)
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', room.quizId))
      .collect()
    return {
      _id: room._id,
      code: room.code,
      state: room.state,
      currentIndex: room.currentIndex,
      quizTitle: quiz?.title ?? 'Quiz',
      totalQuestions: questions.length,
    }
  },
})

// The question a player should currently see. Crucially, `correctIndex` is only
// included once the room is in "reveal"/"ended" state so the answer can't leak.
export const getCurrentQuestion = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId)
    if (!room) return null
    if (room.state === 'lobby' || room.state === 'ended') {
      return { state: room.state }
    }
    const question = await getQuestionAt(ctx, room.quizId, room.currentIndex)
    if (!question) return { state: room.state }
    const showAnswer = room.state === 'reveal'
    return {
      state: room.state,
      questionId: question._id,
      order: question.order,
      text: question.text,
      choices: question.choices,
      timeLimitSec: question.timeLimitSec,
      questionStartedAt: room.questionStartedAt,
      correctIndex: showAnswer ? question.correctIndex : undefined,
    }
  },
})

export const listParticipants = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const players = await ctx.db
      .query('participants')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect()
    return players.map((p) => ({ _id: p._id, name: p.name, score: p.score }))
  },
})

export const getLeaderboard = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const players = await ctx.db
      .query('participants')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect()
    players.sort((a, b) => b.score - a.score)
    return players.map((p, i) => ({
      _id: p._id,
      name: p.name,
      score: p.score,
      rank: i + 1,
    }))
  },
})

// Per-choice answer tallies for the current question (host's live results bars).
export const getLiveResults = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId)
    if (!room) return null
    const question = await getQuestionAt(ctx, room.quizId, room.currentIndex)
    if (!question) return null
    const answers = await ctx.db
      .query('answers')
      .withIndex('by_room_question', (q) =>
        q.eq('roomId', roomId).eq('questionId', question._id),
      )
      .collect()
    const counts = question.choices.map(() => 0)
    for (const a of answers) counts[a.choiceIndex]++
    return {
      questionId: question._id,
      counts,
      totalAnswers: answers.length,
      correctIndex: question.correctIndex,
    }
  },
})

// ---- Cron cleanup ----

export const cleanupStaleRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000 // 6 hours
    const stale = await ctx.db
      .query('rooms')
      .filter((q) => q.lt(q.field('createdAt'), cutoff))
      .collect()
    for (const room of stale) {
      const participants = await ctx.db
        .query('participants')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect()
      for (const p of participants) await ctx.db.delete(p._id)
      const answers = await ctx.db
        .query('answers')
        .withIndex('by_room_question', (q) => q.eq('roomId', room._id))
        .collect()
      for (const a of answers) await ctx.db.delete(a._id)
      await ctx.db.delete(room._id)
    }
    return { deleted: stale.length }
  },
})
