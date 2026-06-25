import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

// Password sign-in for quiz hosts. Players join rooms as guests (no account).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
})
