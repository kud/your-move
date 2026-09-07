import type { CSSProperties } from "react"

import { BOARD_W, BoardSkeleton } from "@/components/board"
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
 * Deliberately not a spinner, and deliberately not a grey rectangle either.
 *
 * The board's FURNITURE is schema — the two lifecycles, the seven columns,
 * their marks and their names all exist before GitHub answers — so it is drawn
 * for real and only the cells shimmer. That is what makes the hand-off a board
 * filling in rather than one screen replacing another: nothing reflows, because
 * the grid, the seams and the sticky offsets were already right. The one thing
 * a header cannot honestly say yet is a count, so it says `–` rather than `0`.
 *
 * It used to be one shimmering rectangle where the board goes, which is exactly
 * the grey bar this comment claimed it was not.
 */

/*
 * Four, and deliberately fewer than a real board.
 *
 * The count is unknown, so the only choice available is which direction to be
 * wrong in — and the two are not symmetric. Guessing low means the board GROWS
 * downward at hand-off, extending what you are already reading. Guessing high
 * means it COLLAPSES, yanking content out from under the eye mid-read.
 */
const LANES = 4

/* Vary what carries no meaning, fix what does. Nobody reads information out of
   how long a repo name is, so varying these stops the label column being one
   grey bar. Card COUNTS do not vary: a count is a claim about where your work
   is, and we do not have one yet. */
const NAME_W = ["72%", "54%", "86%", "63%"]
export const Booting = () => (
  <main
    style={{ "--ym-frame": `${BOARD_W}px` } as CSSProperties}
    className="relative z-10 mx-auto flex h-safe max-w-[var(--ym-frame)] flex-col px-3 pb-3 pt-4 md:px-6 md:pb-6 md:pt-8"
  >
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

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
      <BoardSkeleton />
    </div>
  </main>
)
