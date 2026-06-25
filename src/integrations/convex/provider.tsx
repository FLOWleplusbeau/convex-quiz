import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL')
}

const convex = new ConvexReactClient(CONVEX_URL)

// Wraps the app in Convex Auth, which also provides the Convex client used by
// the `convex/react` hooks (useQuery / useMutation) for live data.
export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
}
