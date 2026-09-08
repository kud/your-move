"use client"

import { useEffect, useState } from "react"

import { Inbox } from "@/components/inbox"
import type { Inbox as InboxData } from "@/lib/github"
import { readKept } from "@/lib/kept"

/*
 * What a home-screen launch shows when there is no network.
 *
 * The service worker precaches this page at install time and serves it in place
 * of the browser's error page on any failed navigation. That is unchanged, and
 * so is the rule behind it: `public/sw.js` puts NO access-controlled response
 * into Cache Storage, because a cached board outlives the session cookie that
 * gated it. Nothing here touches that.
 *
 * What did change is what happens once this page is running. It used to say the
 * board was unreachable and stop there — which is contradicted by the two other
 * layers of this app. `lib/cache.ts` serves a ninety-minute-stale board rather
 * than an error, on the stated grounds that an hour-old board saying it is an
 * hour old beats an empty one saying nothing could be read; `use-inbox.ts` says
 * the same about the browser's copy. This page was the outlier, and it is the
 * layer closest to the reader.
 *
 * So it reads `ym:last` — same-origin script-gated storage the worker never
 * sees, written by this device from an answer it was authorised to receive —
 * and renders it if `lib/kept.ts` will vouch for it. When it will not, the card
 * below is exactly what was here before.
 *
 * The session caveat is real and lives in `lib/kept.ts`: rendering offline
 * means rendering without being able to prove the session is still valid. The
 * ceiling there makes that window finite rather than pretending it is closed.
 */

/* Three states, not two. Before the effect has run there is no answer yet, and
   the difference matters: showing the "nothing to show" card first and swapping
   it for a board a moment later would be a page contradicting itself during the
   one second it is read. */
type Read = { done: false } | { done: true; board?: InboxData }

const Card = () => (
  <main className="grid min-h-safe place-items-center p-6">
    <div className="w-full max-w-[320px] rounded-xl border border-line bg-panel p-5">
      <h1 className="text-[17px] font-semibold">Your Move</h1>

      {/* Glyph and text, never colour alone — the board's own rule.

          `◌` is the mark the board's own liveness dot and its offline banner
          both draw. This said "`○` … the same lexicon" while drawing a
          different glyph from the two surfaces it named, which is how a
          one-glyph drift survives: the comment asserts the consistency instead
          of the code carrying it. One fact, one mark, on all three screens; the
          WORDS are what separate "no network at all" from "the board you have
          is old". */}
      <p className="mt-2 flex items-start gap-1.5 text-[14px] text-fg-mute">
        <span aria-hidden>◌</span>
        <span>
          No network, and nothing kept on this device recent enough to show. The
          board lives on GitHub, so there is nothing to show until you are back.
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

const Offline = () => {
  const [read, setRead] = useState<Read>({ done: false })

  /* In an effect rather than a `useState` initialiser: this page is
     prerendered so the worker has something to precache, and there is no
     `localStorage` at that point. An initialiser would read `undefined` on the
     server and a board on the client, which is a hydration mismatch. */
  useEffect(() => setRead({ done: true, board: readKept() }), [])

  if (!read.done) return null

  return read.board ? <Inbox initial={read.board} offline /> : <Card />
}

export default Offline
