/*
 * Demo mode: a signed-in board with no GitHub behind it.
 *
 * Vercel previews get it for free — `VERCEL_ENV` is `preview` there — and any
 * other non-production deploy opts in with `YOUR_MOVE_DEMO=1`. Production is
 * never demo, whatever else is set: the `!== "production"` guard is what keeps
 * a stray variable on a real deploy from opening a door that shows sample data
 * under a real session cookie.
 *
 * Fail closed throughout: unset, self-hosted without the flag, and production
 * are all not demo. Env is read at call time so tests can set and restore it
 * around each case rather than fighting module state.
 */

export const isDemo = (): boolean => {
  if (process.env.VERCEL_ENV === "preview") return true
  return (
    process.env.YOUR_MOVE_DEMO === "1" &&
    process.env.VERCEL_ENV !== "production"
  )
}

/*
 * The session token a pretend login seals.
 *
 * `demo:` with the trailing colon, which is the whole of the guarantee: a
 * bearer token never contains one, so no real GitHub token can equal this and
 * no comparison can confuse the two. The sentinel is recognised only unsealed
 * from the session cookie AND with `isDemo()` true beside it — a demo cookie
 * replayed against production is then just an invalid token, good for a 401
 * from GitHub and nothing else.
 */
export const DEMO_TOKEN = "demo:"

/* A demo session is the sentinel, honoured only while demo mode holds. */
export const isDemoSession = (token: unknown): token is typeof DEMO_TOKEN =>
  isDemo() && token === DEMO_TOKEN

/*
 * The session token a route may actually use.
 *
 * In demo mode a real token unsealed from a real login must never win: the
 * route below would then call GitHub with it, spending the visitor's identity
 * on a board that promised sample data and no network. Anything that is not
 * the sentinel therefore reads as signed out while demo holds, and the usual
 * no-session paths — 401 from an API, the login redirect from a page — are
 * what offer the pretend sign-in instead. Outside demo every token passes
 * through untouched, sentinel included, so a demo cookie replayed against
 * production stays just an invalid token.
 */
export const usableSessionToken = (
  token: string | undefined,
): string | undefined => (isDemo() && token !== DEMO_TOKEN ? undefined : token)

/*
 * The key a demo session seals under when no `SESSION_SECRET` is set.
 *
 * Fixed and public, which is why it is demo-only: it protects nothing, and a
 * demo board holds no one's facts. It exists so a preview or a local run with
 * no secrets configured still signs in — every route that opens the session
 * reads through here rather than reaching for the variable directly.
 */
export const DEMO_FALLBACK_SECRET = "your-move-demo-only-not-a-secret"

export const sessionSecret = (): string | undefined =>
  process.env.SESSION_SECRET ?? (isDemo() ? DEMO_FALLBACK_SECRET : undefined)
