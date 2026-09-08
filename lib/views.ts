import type { Picks } from "@/components/filters"

/*
 * Named filter sets — "at work", "at home" — kept on the device.
 *
 * Worth saying why this is a store at all, on a board whose whole argument is
 * derive-never-mirror. That rule is about GitHub's facts: anything we copied
 * could be wrong while GitHub was right, and wrong invisibly.
 *
 * `move`, `status` and `labels` are predicates — they have no source of truth
 * anywhere else, so there is nothing for them to disagree with. `repos` is the
 * one that does not get that defence for free: an enumeration of repository
 * names IS a copy of GitHub's repo list as of the moment it was ticked, and it
 * goes wrong by omission the moment a repository is added — silently, which is
 * the exact failure the mirror rule exists to catch. `owners` is the honest
 * form of the same intent: it copies nothing and is evaluated against whatever
 * GitHub returned this second.
 *
 * `localStorage` rather than the URL, which already carries the CURRENT picks:
 * the URL answers "what am I looking at", a view answers "the three shapes I
 * switch between", and a bookmark is a poor control on a phone.
 *
 * Per device, and honestly so — see `EXPORT` below. Everything here is written
 * so that a store which is empty, corrupt, or from a future version degrades to
 * "no saved views" rather than to a broken sheet.
 */

const KEY = "ym:views"

/** Bumped only if the shape changes in a way an old file cannot satisfy. */
const VERSION = 1

export type View = { name: string; picks: Picks }

const EMPTY: Picks = {
  repos: [],
  owners: [],
  status: [],
  labels: [],
  move: [],
}

/* Anything that is not an array of strings is dropped rather than trusted: this
   parses a file a human may have edited by hand. */
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : []

const asPicks = (value: unknown): Picks => {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    repos: strings(raw.repos),
    owners: strings(raw.owners),
    status: strings(raw.status),
    labels: strings(raw.labels),
    move: strings(raw.move).filter((m) => m === "you" || m === "them"),
  }
}

const asViews = (value: unknown): View[] =>
  (Array.isArray(value) ? value : [])
    .map((entry) => {
      const raw = (entry ?? {}) as Record<string, unknown>
      const name = typeof raw.name === "string" ? raw.name.trim() : ""
      return name ? { name, picks: asPicks(raw.picks) } : undefined
    })
    .filter((v): v is View => Boolean(v))

export const readViews = (): View[] => {
  try {
    return asViews(JSON.parse(localStorage.getItem(KEY) ?? "[]"))
  } catch {
    return []
  }
}

export const writeViews = (views: View[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(views))
  } catch {
    /* Private window, or storage refused. The views in hand still work for this
       session; only their survival is lost, and there is nothing useful to say
       about that at the moment it happens. */
  }
}

export const isEmptyPicks = (picks: Picks) =>
  !picks.repos.length &&
  !picks.owners.length &&
  !picks.status.length &&
  !picks.labels.length &&
  !picks.move.length

export const samePicks = (a: Picks, b: Picks) =>
  (["repos", "owners", "status", "labels", "move"] as const).every(
    (key) =>
      a[key].length === b[key].length &&
      [...a[key]].sort().join("\u0000") === [...b[key]].sort().join("\u0000"),
  )

export const emptyPicks = (): Picks => ({ ...EMPTY })

/*
 * The picks the URL is currently asking for.
 *
 * Server and client both call this, and that is the whole point of it being a
 * function rather than two effects. `picks` used to start empty and be filled
 * on mount, so the board's own server HTML rendered UNFILTERED — the chip row
 * then appeared a flush later and shoved every lane down it. One reader, called
 * in both places, and the row is either in the first paint or in neither.
 *
 * Takes a getter rather than a `URLSearchParams`, because the two callers do not
 * hold the same thing: the server is handed a bag whose values may be arrays,
 * the client has `location.search`. Neither should have to convert for the other.
 */
export const picksFromQuery = (
  get: (key: string) => string | undefined,
): Picks => {
  const read = (key: string) => (get(key) ?? "").split(",").filter(Boolean)
  return {
    repos: read("repos"),
    owners: read("owners"),
    status: read("status"),
    labels: read("labels"),
    move: read("move"),
  }
}

/*
 * The file, and the reason it exists.
 *
 * These live on one device. A second device is a real want and there is a real
 * way to serve it — a private gist, which is free, is his own data, and syncs
 * everywhere — but it costs a wider OAuth scope, which is a decision rather than
 * a detail. Until that is decided, a file you carry across yourself is the
 * honest version: it makes the per-device limit visible instead of pretending
 * it away, and it is the same JSON either mechanism would move.
 *
 * Versioned so that a file written today still reads on an app that has since
 * grown a fifth facet — `asPicks` fills what is missing rather than refusing
 * the file.
 */
export const exportViews = (views: View[]) =>
  JSON.stringify({ app: "your-move", version: VERSION, views }, null, 2)

export const importViews = (text: string): View[] => {
  const parsed = JSON.parse(text) as Record<string, unknown>
  /* A bare array is accepted too — that is what someone hand-editing will most
     likely produce, and refusing it would be pedantry rather than safety. */
  return asViews(Array.isArray(parsed) ? parsed : parsed?.views)
}

/*
 * The same set, as a link.
 *
 * A file was the honest first answer and it is the wrong shape for the actual
 * journey: export on the desk, get the file to the phone somehow, then find a
 * file picker inside an installed PWA. A link is one tap.
 *
 * In the FRAGMENT, not the query, and that is the load-bearing choice. A
 * fragment is never sent to the server — not in the request, not in a log, not
 * in an analytics referrer — and these payloads carry repository names, some of
 * which are private. The same reasoning says a shared link is still yours to be
 * careful with: pasting one into a chat publishes the names in it, whoever
 * holds the other end.
 *
 * Base64url rather than plain base64, so the value survives being a URL without
 * escaping, and `encodeURIComponent` on top would double the length for nothing.
 */

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  return new TextDecoder().decode(
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  )
}

/** The whole set, encoded for a `#views=` fragment. */
export const encodeShare = (views: View[]) =>
  toBase64Url(JSON.stringify({ v: VERSION, views }))

/*
 * Anything unreadable is nothing, not an error. A truncated link — chat clients
 * do truncate — should leave the board exactly as it was rather than announcing
 * a failure about a feature the reader may not have known they used.
 */
export const decodeShare = (value: string): View[] => {
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as Record<string, unknown>
    return asViews(Array.isArray(parsed) ? parsed : parsed?.views)
  } catch {
    return []
  }
}
