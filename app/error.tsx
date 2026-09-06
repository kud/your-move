"use client"

/*
 * The one screen that exists so a crash is not a blank page.
 *
 * `app/page.tsx` streams: the shell flushes, then the board arrives on the same
 * connection. If the server render throws after the first flush, the browser is
 * left holding a truncated document whose Suspense boundary never resolves —
 * the boot shell, for ever, with no client fetch coming to rescue it. Without a
 * boundary that is indistinguishable from a slow morning.
 *
 * Deliberately plain, and deliberately not a bug report. It says the one true
 * thing, offers the one action that helps, and does not pretend to know what
 * went wrong.
 */
const Error = ({ reset }: { error: Error; reset: () => void }) => (
  <main className="grid h-safe place-items-center p-6">
    <div className="w-full max-w-[320px] rounded-2xl border border-line bg-panel p-5">
      <h1 className="font-serif text-[19px] font-semibold">
        The board did not load
      </h1>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-fg-mute">
        Something failed on the way here. Nothing was changed on GitHub.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-accent bg-accent-dim px-3 py-1.5 text-[13.5px] text-accent"
        >
          Try again
        </button>
        <a
          href="https://github.com/pulls"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line px-3 py-1.5 text-[13.5px] text-fg-mute"
        >
          Go to GitHub ↗
        </a>
      </div>
    </div>
  </main>
)

export default Error
