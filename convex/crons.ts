import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Showcase: scheduled recurring jobs. Cleans up abandoned rooms hourly.
crons.interval(
  'cleanup stale rooms',
  { hours: 1 },
  internal.rooms.cleanupStaleRooms,
  {},
)

export default crons
