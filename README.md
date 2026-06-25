# Convex Live Quiz

A real-time, multiplayer quiz app (Kahoot-style) built to show off **Convex**'s
best features, with a **TanStack Start (React)** frontend, **Tailwind +
shadcn-style UI**, and **Bun** as the package manager.

## What it demonstrates

- **Reactive queries** — the host's participant list, live answer tallies, and
  the leaderboard update instantly for every connected client. No polling, no
  manual refresh.
- **Scheduled functions** — when a question starts, a server-side job is
  scheduled (`ctx.scheduler.runAfter`) to auto-reveal the answer when the timer
  runs out.
- **Cron jobs** — abandoned rooms are cleaned up hourly (`convex/crons.ts`).
- **Transactional mutations** — answer recording + scoring happen atomically,
  with a guard against double-answering.
- **Convex Auth** — password sign-in for hosts; players join rooms as guests.

## How it works

1. A host signs in and builds a **quiz** (questions + choices + per-question
   timer).
2. The host opens a **room**, which gets a short **join code**.
3. Players go to `/play/<CODE>`, pick a name, and join — appearing live in the
   host's lobby.
4. The host starts the quiz; players answer; results and the leaderboard update
   in real time. Each question auto-advances to "reveal" when its timer expires.

## Project layout

```
convex/
  schema.ts      # tables: quizzes, questions, rooms, participants, answers (+ authTables)
  auth.ts        # Convex Auth, Password provider
  http.ts        # auth HTTP routes
  quizzes.ts     # quiz authoring (auth-gated)
  rooms.ts       # live game logic + scheduled reveal + cron cleanup
  users.ts       # currentUser query
  crons.ts       # hourly stale-room cleanup
src/
  routes/        # TanStack Start file-based routes
    index.tsx              # landing (join / host)
    login.tsx             # host sign in / sign up
    host.tsx              # auth gate (layout)
    host.index.tsx        # host dashboard
    host.quiz.$quizId.tsx # quiz editor
    host.room.$roomId.tsx # host live control panel
    play.$code.tsx        # player screen
  components/ui/  # shadcn-style primitives (Button, Card, Input, Label)
  integrations/convex/provider.tsx  # ConvexAuthProvider
```

## Setup

Requires Bun and a (free) Convex account.

```bash
bun install

# 1. Log in + create the Convex project, push the backend (interactive: opens a
#    browser to log in, then prompts to create a new project). Writes
#    CONVEX_DEPLOYMENT + VITE_CONVEX_URL to .env.local.
bunx convex dev --once

# 2. Configure Convex Auth env vars (JWT keys, SITE_URL) on the deployment.
bunx @convex-dev/auth

# 3. Run the backend watcher + frontend together.
bunx convex dev      # terminal 1 — pushes function changes live
bun run dev          # terminal 2 — http://localhost:3000
```

Open `http://localhost:3000`, sign in as a host, build a quiz, start a room, and
join from other browser tabs at `/play/<CODE>`.
