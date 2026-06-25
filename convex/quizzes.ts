import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

// Helper: require an authenticated host, returning their user id.
async function requireHost(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any)
  if (!userId) throw new Error('Not signed in')
  return userId
}

export const createQuiz = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const hostId = await requireHost(ctx)
    return await ctx.db.insert('quizzes', {
      title: title.trim() || 'Untitled quiz',
      hostId,
      createdAt: Date.now(),
    })
  },
})

export const addQuestion = mutation({
  args: {
    quizId: v.id('quizzes'),
    text: v.string(),
    choices: v.array(v.string()),
    correctIndex: v.number(),
    timeLimitSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hostId = await requireHost(ctx)
    const quiz = await ctx.db.get(args.quizId)
    if (!quiz || quiz.hostId !== hostId) throw new Error('Quiz not found')

    const existing = await ctx.db
      .query('questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', args.quizId))
      .collect()

    return await ctx.db.insert('questions', {
      quizId: args.quizId,
      order: existing.length,
      text: args.text.trim(),
      choices: args.choices,
      correctIndex: args.correctIndex,
      timeLimitSec: args.timeLimitSec ?? 20,
    })
  },
})

export const deleteQuestion = mutation({
  args: { questionId: v.id('questions') },
  handler: async (ctx, { questionId }) => {
    const hostId = await requireHost(ctx)
    const question = await ctx.db.get(questionId)
    if (!question) return
    const quiz = await ctx.db.get(question.quizId)
    if (!quiz || quiz.hostId !== hostId) throw new Error('Not allowed')
    await ctx.db.delete(questionId)
  },
})

export const listMyQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const hostId = await getAuthUserId(ctx)
    if (!hostId) return []
    const quizzes = await ctx.db
      .query('quizzes')
      .withIndex('by_host', (q) => q.eq('hostId', hostId))
      .order('desc')
      .collect()

    // Attach a question count for the dashboard.
    return await Promise.all(
      quizzes.map(async (quiz) => {
        const questions = await ctx.db
          .query('questions')
          .withIndex('by_quiz', (q) => q.eq('quizId', quiz._id))
          .collect()
        return { ...quiz, questionCount: questions.length }
      }),
    )
  },
})

export const getQuizWithQuestions = query({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const hostId = await getAuthUserId(ctx)
    const quiz = await ctx.db.get(quizId)
    if (!quiz || quiz.hostId !== hostId) return null
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_quiz', (q) => q.eq('quizId', quizId))
      .collect()
    questions.sort((a, b) => a.order - b.order)
    return { quiz, questions }
  },
})
