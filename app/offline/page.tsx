/*
 * What a home-screen launch shows when there is no network.
 *
 * Static on purpose, and outside the gate: the service worker precaches it at
 * install time and serves it in place of the browser's error page, so it can
 * hold nothing that a session would have been needed to see. It says the board
 * is unreachable — it never shows a stale one, which would be indistinguishable
 * from a current one at exactly the moment that distinction matters.
 */

const Offline = () => (
  <main className="grid min-h-safe place-items-center p-6">
    <div className="w-full max-w-[320px] rounded-xl border border-line bg-panel p-5">
      <h1 className="text-[17px] font-semibold">Your Move</h1>

      {/* Glyph and text, never colour alone — the board's own rule. `○` is
          "open/absent" in the same lexicon the cockpit's liveness dot uses. */}
      <p className="mt-2 flex items-start gap-1.5 text-[14px] text-fg-mute">
        <span aria-hidden>○</span>
        <span>
          No network. The board lives on GitHub, so there is nothing to show
          until you are back.
        </span>
      </p>

      <a
        href="/"
        className="mt-4 block rounded-lg border border-line bg-raise px-3 py-2 text-center text-[15px] font-medium no-underline transition-colors hover:border-accent"
      >
        Try again
      </a>
    </div>
  </main>
)

export default Offline
