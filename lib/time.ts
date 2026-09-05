const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Compact age for a fixed-width slot: 40s · 12m · 5h · 3d · 2w.
 *
 * `now` is required on purpose. A default clock read during render makes the
 * server and the client disagree by the length of the round trip, which React
 * reports as a hydration failure — see components/ago.tsx. */
export const ago = (iso: string | null, now: number): string => {
  if (!iso) return "—"

  const delta = Math.max(0, now - new Date(iso).getTime())
  if (delta < MINUTE) return `${Math.max(1, Math.round(delta / 1000))}s`
  if (delta < HOUR) return `${Math.round(delta / MINUTE)}m`
  if (delta < DAY) return `${Math.round(delta / HOUR)}h`
  if (delta < 14 * DAY) return `${Math.round(delta / DAY)}d`
  return `${Math.round(delta / (7 * DAY))}w`
}

/** A session is "live" only while a process is alive; recency alone is a ghost. */
export const isFresh = (
  iso: string | null,
  now: number,
  withinMs = 2 * MINUTE,
) => Boolean(iso) && now - new Date(iso as string).getTime() < withinMs
