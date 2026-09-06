import { Mark } from "@/components/mark"

/*
 * What the first flush paints, while the board is still being read.
 *
 * This exists to end an OS splash screen, which is a stranger reason than it
 * sounds. Chrome holds its splash — the icon, and the app name in a system font
 * nothing of ours can style — until the page can paint. The page could not
 * paint, because it awaited four GraphQL queries before returning a byte. So a
 * cold open sat on Chrome's screen for the whole read, and the one thing we
 * could not restyle was the thing we were showing the longest.
 *
 * Deliberately not a spinner. It is the app's own furniture at its real
 * measurements, so the hand-off is a board filling in rather than one screen
 * replacing another — and the header is genuinely finished, not a grey bar
 * pretending to be one. Nothing here moves except the shimmer, which is the
 * same rhythm the detail panel already uses for the same claim.
 */
export const Booting = () => (
  <main className="relative z-10 mx-auto flex h-safe max-w-[1600px] flex-col px-3 pb-3 pt-4 md:px-6 md:pb-6 md:pt-8">
    <header className="flex items-center gap-2 pb-3 md:flex-wrap md:items-end md:gap-x-4 md:pb-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
        <Mark className="h-auto w-6 shrink-0 md:w-[30px]" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-baseline gap-2 font-serif text-[19px] font-semibold leading-tight tracking-[-0.015em] md:text-[27px]">
            Your Move
            <span className="hidden truncate font-sans text-[13px] font-normal tracking-normal text-fg-quiet md:inline">
              GitHub moves. Your turn.
            </span>
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-quiet md:font-mono md:text-[9.5px] md:uppercase md:tracking-[0.16em]">
            <span aria-hidden>◌</span>
            Reading GitHub
          </p>
        </div>
      </div>
    </header>

    <div className="shimmer min-h-0 flex-1 rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]" />
  </main>
)
