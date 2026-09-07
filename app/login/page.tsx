/*
 * One link, and as little else as the page can get away with.
 *
 * No form, no session read, no data fetching — the whole flow is
 * `/api/auth/login` redirecting to GitHub, and the anchor below is server-
 * rendered HTML with nothing between the tap and GitHub. The page stays an
 * async server component; only the theme switch is a client leaf, and the
 * route already hydrates regardless, since the root layout mounts `Leaving`
 * and `ServiceWorker` on every route.
 */

import { GitHubMark } from "@/components/github-mark"
import { ThemeSwitch } from "@/components/theme-switch"

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
    <main className="relative grid min-h-safe place-items-center p-6">
      {/*
        Top right, and pinned to the viewport rather than to the card.

        Iris argued for it under the card — on a page holding one centred object
        a corner control reads as an orphan, with nothing beside it to give it
        scale. Erwann asked for the corner, saw both, and kept the corner: it is
        where a theme control lives on every other site, so it is where a hand
        goes looking without being told. His call.

        The safe-area insets are the cost of the corner and are not optional —
        this installs as a PWA, so on a notched phone a bare `top-4` would sit
        under the status bar.
      */}
      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]">
        <ThemeSwitch quiet />
      </div>

      <div>
        <div className="w-full max-w-[320px] rounded-xl border border-line bg-panel p-5">
          <h1 className="text-[17px] font-semibold">Your Move</h1>
          <p className="mt-1 text-[14px] text-fg-quiet">
            What moved, and whose move it is. Sign in with GitHub — the board
            reads only what you can already see.
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
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[15px] hover:border-accent"
          >
            <GitHubMark className="size-[18px] shrink-0 text-fg-mute" />
            Sign in with GitHub
          </a>
        </div>

      </div>
    </main>
  )
}

export default Login
