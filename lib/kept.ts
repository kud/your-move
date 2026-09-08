import type { Inbox } from "@/lib/github"

/*
 * The last good board, kept in this browser — and the three things that must be
 * true before it may be shown again.
 *
 * The board itself is worth keeping for the reasons `use-inbox.ts` gives: the
 * browser is the same device that saw the good answer, it survives instances and
 * deploys, and the stored board carries its original `fetchedAt`, so the page
 * says "as of 40 minutes ago" rather than pretending to be current.
 *
 * What it did not have was any reason to believe what it read back. `kept()`
 * was `JSON.parse` cast straight to `Inbox` — so a board written by a different
 * version of the row model, or one from an arbitrary distance in the past, was
 * indistinguishable from a good one. Both are ordinary: the model changed three
 * times in a single day, and a phone opened offline may not have been opened in
 * a fortnight.
 *
 * SESSION. This is the honest limit and it is written here rather than left
 * implied. Rendering a stored board offline means rendering it WITHOUT BEING
 * ABLE TO PROVE THE SESSION IS STILL VALID — the cookie is `HttpOnly` and only
 * the server can judge it, and offline there is no server to ask. A revoked
 * token and an expired cookie are both invisible from here. `menu.tsx` clears
 * this key on a deliberate sign-out, which covers the case the reader controls;
 * the ceiling below covers the rest, by making the window finite rather than by
 * pretending it can be closed. That is a trade made for a personal device and it
 * should be re-made before this is ever a shared one.
 *
 * The stored board holds repository names, identifiers and titles in plain
 * JSON. None of that is a secret the app is keeping FROM the reader — it is
 * theirs — but it is a fact about their employer sitting on a device, so how
 * long it sits is a decision rather than an accident.
 */

const KEY = "ym:last"

/*
 * The shape of what is stored, bumped whenever the board model changes in a way
 * a previous version's board would render wrongly.
 *
 * Additive changes do not need a bump — a row without `heat` reads as
 * `undefined`, which every consumer already handles. A REMOVED or reinterpreted
 * field does, and the tell is that the old board would render without throwing
 * and be wrong, which is the failure this whole file exists to make impossible.
 */
const V = 1

/*
 * Past this, refuse rather than render.
 *
 * An hour-old board that says it is an hour old is better than an empty one.
 * A three-week-old board is not: every count on it is wrong, every "needs you"
 * is a guess about a fortnight ago, and the reader's trust in the age label is
 * precisely what a board that old spends. A day is roughly the point where
 * "what moved" stops being a question the stored answer can speak to.
 */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000

type Envelope = { v: number; inbox: Inbox }

/** What a stored board must look like before any of it is believed. */
const looksLikeInbox = (value: unknown): value is Inbox => {
  if (typeof value !== "object" || value === null) return false
  const inbox = value as Partial<Inbox>
  return (
    Array.isArray(inbox.rows) &&
    Array.isArray(inbox.failed) &&
    typeof inbox.fetchedAt === "number" &&
    Number.isFinite(inbox.fetchedAt)
  )
}

export const envelope = (inbox: Inbox): Envelope => ({ v: V, inbox })

/*
 * The whole policy, as one pure function, so it can be tested without a browser.
 *
 * Deliberately total: every way of being unusable returns the same `undefined`,
 * because the caller has exactly one thing to do about it. A version mismatch,
 * a truncated write, a board from last month and a key someone hand-edited are
 * four causes of one situation — there is no stored board to show.
 */
export const usable = (raw: unknown, now: number): Inbox | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const { v, inbox } = raw as Partial<Envelope>
  if (v !== V) return undefined
  if (!looksLikeInbox(inbox)) return undefined

  /* A board stamped in the future is a clock that moved, not a fresh board.
     Treated as unusable rather than clamped: the age label is the only thing
     making a stale board honest, and one that cannot be computed is worse than
     no board at all. */
  const age = now - inbox.fetchedAt
  if (age < 0 || age > MAX_AGE_MS) return undefined

  return inbox
}

/*
 * Storage from here down. Every one of these swallows: quota, a private window,
 * storage refused outright, a value another tab is mid-write on. Losing the
 * fallback is never worth a failed render.
 */

export const writeKept = (inbox: Inbox) => {
  /* A partial answer must never become the remembered one — an empty column in
     a stored board is indistinguishable from an empty status. */
  if (inbox.failed.length) return
  try {
    localStorage.setItem(KEY, JSON.stringify(envelope(inbox)))
  } catch {}
}

export const forgetKept = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

export const readKept = (now = Date.now()): Inbox | undefined => {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return undefined
  }
  if (!raw) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }

  const inbox = usable(parsed, now)
  /* Nothing will ever make it usable again, and it is a board sitting on a
     device — so the refusal takes it with it rather than leaving it to age. */
  if (!inbox) forgetKept()
  return inbox
}
