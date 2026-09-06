import type { Inbox } from "@/lib/github"

/*
 * A cache, and the distinction from a mirror is the whole point.
 *
 * The test is what happens when it is empty: a mirror is then WRONG, invisibly —
 * it holds facts that live elsewhere and can drift from them. This holds nothing
 * that is not also on GitHub right now, so cold means one slow request, never a
 * wrong answer. Delete it and you lose a second, not a fact.
 *
 * It exists because the naive version spent GitHub's hourly budget on itself: a
 * page open costs one fetch server-side and another from the client on mount,
 * every tab is its own poll, and the terminal surface shares the same account.
 * ~74 GraphQL points a load against 5,000 an hour is not a lot of room.
 *
 * In-process rather than a database, deliberately. A serverless instance keeps
 * it while warm and loses it on a cold start, which is exactly the right
 * durability for something whose worst failure is a slow page — and it adds no
 * component that can be down while GitHub is up.
 */

type Entry = { at: number; inbox: Inbox }

/** Long enough to absorb an open plus its poll; short enough to feel live. */
const TTL_MS = 60 * 1000

/*
 * How long a stale answer may still be served when GitHub refuses. Generous on
 * purpose: an hour-old board that says it is an hour old is far better than an
 * empty one that says nothing could be read, and the rate limit resets hourly.
 */
const STALE_MS = 90 * 60 * 1000

const store = new Map<string, Entry>()

/*
 * Keyed by a digest of the token, never the token. The map is process-local, but
 * a raw credential as a key is the kind of thing that ends up in a heap dump or
 * a log line, and hashing costs nothing.
 */
const keyFor = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  )
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export const cached = async (token: string): Promise<Inbox | undefined> => {
  const entry = store.get(await keyFor(token))
  if (!entry) return undefined
  return Date.now() - entry.at < TTL_MS ? entry.inbox : undefined
}

/**
 * The last answer we have, however old, for when GitHub will not answer at all.
 *
 * Returned with its ORIGINAL `fetchedAt`, so the board says "as of 40 minutes
 * ago" rather than pretending to be current. A cache that lies about its age is
 * a mirror with extra steps.
 */
export const lastResort = async (token: string): Promise<Inbox | undefined> => {
  const entry = store.get(await keyFor(token))
  if (!entry) return undefined
  return Date.now() - entry.at < STALE_MS ? entry.inbox : undefined
}

export const remember = async (token: string, inbox: Inbox): Promise<void> => {
  /* Never cache a partial answer as though it were whole: a board missing four
     sources would then be served to every request for the next minute. */
  if (inbox.failed.length) return

  store.set(await keyFor(token), { at: Date.now(), inbox })

  /* One user, one entry, in practice — but an unbounded map in a long-lived
     instance is a leak waiting for a second user. */
  if (store.size > 32) {
    const oldest = [...store].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) store.delete(oldest[0])
  }
}
