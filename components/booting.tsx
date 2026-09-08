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
 * for real and only the cells shimmer.
 *
 * The GRID does not reflow at hand-off, and that much is by construction rather
 * than by care: `BoardSkeleton` mounts the board's own `BoardHead`, and the two
 * track lists resolve to the same 2250px.
 *
 * The chip row is the one that had to be handed in. A filtered board carries a
 * row this shell had no counterpart for, so at hand-off a whole row appeared and
 * shoved the board down — and the row's presence is not something the shell can
 * work out for itself, because it is a fact about the URL rather than about the
 * data. `app/page.tsx` reads it once and tells both halves; `filtered` is that
 * answer. It reserves the box and nothing else: how MANY facets, and what they
 * are called, are still unknown here, and a shell that guessed at them would be
 * inventing the one thing it exists to avoid inventing.
 *
 * Still true, and still not fixed: the loaded board is a scroll container where
 * this shell is `overflow-hidden`, so where the OS draws classic scrollbars one
 * side reserves a gutter the other does not. Do not let this comment say the
 * hand-off is entirely still — that sentence was once written as an intention
 * and read as a fact, which is how it survived a screen recording that plainly
 * showed otherwise. The one thing a header cannot honestly say yet is a count,
 * so it says `–` rather than `0`.
 *
 * It used to be one shimmering rectangle where the board goes, which is exactly
 * the grey bar this comment claimed it was not.
 */

export const Booting = ({ filtered = false }: { filtered?: boolean }) => (
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

      {/*
        The two controls the board carries, at their real size.

        Neither can say anything yet — the filter count is unknown and the
        avatar needs a login — so these are the only things in the header that
        shimmer. Their SIZE is not unknown, and leaving them out entirely was
        the worse lie: the header would then reflow at hand-off, in the one
        place this shell exists to keep still.
      */}
      <div className="flex shrink-0 items-center gap-1.5 md:ml-auto md:gap-2">
        <div className="shimmer size-8 rounded-full border border-line bg-panel-2" />
        <div className="shimmer size-8 rounded-full border border-line bg-panel-2" />
      </div>
    </header>

    {/*
      The chip row's BOX, at the size the real one will be.

      Every class here that affects height is copied from the row in
      `inbox.tsx` — `mb-2`, `py-1.5`, the border, and the `12.5px` text that
      sets the line box. The ones that affect WIDTH are deliberately not: the
      real row is `w-fit`, so its width is a fact about the sentence inside it,
      and this shell does not know the sentence. Width costs nothing here
      anyway — nothing to the right of it moves, and nothing below it cares.

      "Filtered to" is drawn for real because it is true: the URL said so. The
      part that shimmers is the part that is genuinely unknown, which is the
      same line this shell draws everywhere else.
    */}
    {filtered ? (
      <div className="mb-2 flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-accent/50 bg-accent-dim px-2.5 py-1.5 text-[12.5px] text-fg-mute">
        <span className="shrink-0">Filtered to</span>
        <span className="shimmer h-[13px] w-28 rounded bg-panel-2" />
      </div>
    ) : null}

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
      <BoardSkeleton />
    </div>

    {/*
      Drawn for real, not shimmered — every word of it is static.

      Same rule as the column headers: what is SCHEMA is known before GitHub
      answers, and greying it would be a lie in the other direction. Nothing in
      this footer is a fact about the board, which is also why it can carry live
      links while the board behind it is still empty. Omitting it cost the shell
      the one thing it is for, since the board would then resize at hand-off.

      Kept in step with the footer in `inbox.tsx` by hand. It is nine lines of
      static copy; a shared component would put a prop-threaded abstraction
      between two things that simply say the same sentence.
    */}
    <footer className="mt-3 hidden shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px] text-fg-quiet md:flex">
      <span>
        Read live from GitHub, cached for five minutes. Nothing is stored;
        labels are the only thing written back.
      </span>

      {[
        { label: "Source", href: "https://github.com/kud/your-move" },
        {
          label: "Report an issue",
          href: "https://github.com/kud/your-move/issues/new",
        },
        { label: "@kud", href: "https://github.com/kud" },
      ].map((out) => (
        <a
          key={out.label}
          href={out.href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line underline-offset-2 hover:text-fg hover:decoration-accent"
        >
          {out.label}
        </a>
      ))}

      <span className="ml-auto text-right">
        Built to answer one question across a lot of repositories — whose move
        is it — then made general.
      </span>
    </footer>
  </main>
)
