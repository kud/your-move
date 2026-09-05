/*
 * A link, and nothing else.
 *
 * No form, no state, no client component — the whole flow is `/api/auth/login`
 * redirecting to GitHub. That keeps the one page reachable without a session as
 * small as it can be: nothing here reads the board, and there is no JavaScript
 * for a bug to live in.
 */

const MESSAGES: Record<string, string> = {
  bad_state:
    "That sign-in did not start here, so it was refused. Try again from this page.",
  expired_state: "That sign-in took too long. Try again.",
  access_denied: "You declined access on GitHub.",
  no_token: "GitHub did not return a token. Try again.",
  exchange_failed: "GitHub could not complete the sign-in. Try again.",
}

type Props = { searchParams: Promise<{ to?: string; error?: string }> }

const Login = async ({ searchParams }: Props) => {
  const { to, error } = await searchParams

  /* Path only — `/api/auth/login` refuses anything that is not one, but there
     is no reason to put a hostile value in an href in the first place. */
  const safe = to?.startsWith("/") && !to.startsWith("//") ? to : undefined
  const href = safe
    ? `/api/auth/login?to=${encodeURIComponent(safe)}`
    : "/api/auth/login"

  return (
    <main className="grid min-h-safe place-items-center p-6">
      <div className="w-full max-w-[320px] rounded-xl border border-line bg-panel p-5">
        <h1 className="text-[17px] font-semibold">Your Move</h1>
        <p className="mt-1 text-[14px] text-fg-quiet">
          What moved, and whose move it is. Sign in with GitHub — the board reads
          only what you can already see.
        </p>

        {/* The glyph carries the failure as well as the colour, which is the
            board's own rule and this page is not an exception to it. */}
        {error ? (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-brass">
            <span aria-hidden>!</span>
            <span>{MESSAGES[error] ?? "That sign-in did not work."}</span>
          </p>
        ) : null}

        <a
          href={href}
          className="mt-4 block rounded-lg border border-line bg-panel-2 px-3 py-2 text-center text-[15px] hover:border-accent"
        >
          Sign in with GitHub
        </a>
      </div>
    </main>
  )
}

export default Login
