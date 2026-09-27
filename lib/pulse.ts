import type { Inbox } from "@/lib/github"

/*
 * The decisions behind the board's gentle auto-refresh, pulled out of
 * `components/use-inbox.ts` so they can be asserted without a browser.
 *
 * The shape of the thing: a full read costs ~74 points, so it cannot run every
 * minute (see `POLL_MS` there). A pulse costs one. So the board asks the cheap
 * question every minute — "has anything moved?" — and pays for a full read only
 * when the answer is yes.
 *
 * A pulse is a CURSOR, not a mirror. Its fingerprint is compared for equality
 * with the previous one and for nothing else; nothing is rendered from it and
 * nothing is stored beyond the one string in a ref. That is what keeps this on
 * the right side of CLAUDE.md's never-mirror rule: empty the ref and the cost is
 * one pulse spent re-recording a baseline, never a wrong board.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Past this since the last CONFIRMATION, the answer stops being trusted silently. */
export const STALE_AFTER_MS = 8 * MINUTE

/** How often a visible tab asks whether anything moved. */
export const PULSE_MS = MINUTE

/*
 * The least time between two reads a pulse is allowed to cause.
 *
 * A busy afternoon — a PR getting review comments every thirty seconds — would
 * otherwise turn every pulse into a 74-point read, which is the one-minute poll
 * this design was built to never be again. Three minutes caps a storm at ~1,500
 * points an hour; ten, when the budget is already low, at ~450.
 */
export const PULSE_GAP_MS = 3 * MINUTE
export const LEAN_PULSE_GAP_MS = 10 * MINUTE
/** Below this many points left, the gap widens to `LEAN_PULSE_GAP_MS`. */
export const LEAN_BUDGET = 2000

/*
 * Below this many points left, stop asking on our own and let the reader ask
 * explicitly. A board that spends the last of the budget on an automatic
 * refresh leaves nothing for the deliberate one.
 */
export const BUDGET_FLOOR = 500

export const mayAskAlone = (remaining: number | undefined) =>
  remaining === undefined || remaining >= BUDGET_FLOOR

export const pulseGap = (remaining: number | undefined) =>
  remaining !== undefined && remaining < LEAN_BUDGET
    ? LEAN_PULSE_GAP_MS
    : PULSE_GAP_MS

/**
 * What one pulse's answer means.
 *
 * - `baseline` — the first pulse since a full read. It only records: the read
 *   just told us what the board is, and there is nothing earlier to compare with.
 * - `same` — nothing the board shows has moved.
 * - `read` — something moved, and the gap allows a full read now.
 * - `held` — something moved, but a pulse-caused read happened too recently.
 *   The baseline is NOT advanced, so the next pulse sees the change again and
 *   reads once the gap has passed rather than forgetting it.
 */
export type PulseOutcome = "baseline" | "same" | "read" | "held"

export const pulseOutcome = ({
  baseline,
  fingerprint,
  now,
  lastPulseRead,
  remaining,
}: {
  baseline: string | undefined
  fingerprint: string
  now: number
  /** When a pulse last caused a full read. */
  lastPulseRead: number | undefined
  remaining: number | undefined
}): PulseOutcome => {
  if (baseline === undefined) return "baseline"
  if (fingerprint === baseline) return "same"
  if (lastPulseRead !== undefined && now - lastPulseRead < pulseGap(remaining))
    return "held"
  return "read"
}

/*
 * Staleness keys on CONFIRMATION, age on the read.
 *
 * They used to be one number, `fetchedAt`, and could be because nothing but a
 * full read ever spoke to GitHub. Now a pulse can say "still true" for a point
 * without re-reading the board, so a board read twenty minutes ago and
 * confirmed forty seconds ago is current — and saying "May be out of date"
 * there would be the label lying in the cautious direction, which trains the
 * reader to ignore it on the day it is right.
 *
 * No confirmation at all is not stale: it means no board yet, and the booting
 * state already says so.
 */
export const isStale = (confirmedAt: number | undefined, now: number) =>
  confirmedAt !== undefined && now - confirmedAt > STALE_AFTER_MS

const span = (ms: number) =>
  ms < HOUR ? `${Math.round(ms / MINUTE)} min` : `${Math.round(ms / HOUR)} hr`

/** A pulse since the read that found nothing moved. */
const confirmedSinceRead = (fetchedAt: number, checkedAt: number | undefined) =>
  checkedAt !== undefined && checkedAt >= fetchedAt

/**
 * The header's one freshness segment. Always about the READ — `fetchedAt` —
 * because that is what the rows on screen are.
 *
 * `no change in 14 min` is only said while it is true AND recent: `live` is the
 * hook's liveness after the staleness rule, so once confirmation is older than
 * `STALE_AFTER_MS` the header's `May be out of date ·` takes over and this goes
 * back to a bare age. A "no change" beside "may be out of date" would be two
 * claims arguing.
 */
export const freshnessText = ({
  fetchedAt,
  checkedAt,
  now,
  live,
}: {
  fetchedAt: number
  checkedAt: number | undefined
  now: number
  live: boolean
}) => {
  const age = Math.max(0, now - fetchedAt)
  if (age < MINUTE) return "just now"
  return live && confirmedSinceRead(fetchedAt, checkedAt)
    ? `no change in ${span(age)}`
    : `${span(age)} ago`
}

const secondsAgo = (ms: number) =>
  ms < MINUTE
    ? `${Math.max(1, Math.round(ms / 1000))} s ago`
    : `${span(ms)} ago`

/**
 * The refresh control's accessible name, and its tooltip.
 *
 * It carries the seconds the visible line deliberately drops — the header moves
 * in minutes so it does not read as a stopwatch, but someone who hovers or
 * focuses it is asking exactly how current this is.
 */
export const refreshName = ({
  fetchedAt,
  checkedAt,
  now,
  busy,
}: {
  fetchedAt: number | undefined
  checkedAt: number | undefined
  now: number
  busy: boolean
}) => {
  if (busy) return "Refreshing"
  if (fetchedAt === undefined) return "Refresh"
  const age = Math.max(0, now - fetchedAt)
  const read = age < MINUTE ? "just now" : `${span(age)} ago`
  const checked = confirmedSinceRead(fetchedAt, checkedAt)
    ? `, checked ${secondsAgo(Math.max(0, now - (checkedAt as number)))}, no change`
    : ""
  return `Refresh. Read from GitHub ${read}${checked}.`
}

/*
 * Whether a deliberate refresh found anything, for the one polite line that
 * answers the press. Rows only: `fetchedAt` and the budget always differ, and a
 * "Updated" that fires on every press says nothing.
 */
export const sameBoard = (a: Inbox | undefined, b: Inbox) =>
  a !== undefined && JSON.stringify(a.rows) === JSON.stringify(b.rows)
