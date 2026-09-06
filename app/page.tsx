import { Suspense } from "react"

import { cookies } from "next/headers"

import { Booting } from "@/components/booting"
import { Inbox } from "@/components/inbox"
import { COOKIE, unseal } from "@/lib/auth"
import { cached, remember } from "@/lib/cache"
import { fetchInbox } from "@/lib/github"

/*
 * Fetched on the server for the first paint, then the client takes over polling.
 *
 * The alternative — an empty shell that fetches on mount — costs a client round
 * trip on every open, and this is a board you glance at for ten seconds. The
 * first answer should already be on screen.
 *
 * But awaiting it before returning a single byte was the wrong way to get that,
 * and the cost landed somewhere unexpected: an installed app shows Chrome's own
 * splash until the page can paint, so a cold open sat on a screen we cannot
 * style for the entire length of four GraphQL queries. Streaming keeps the
 * server fetch and drops the block — the shell flushes immediately, the board
 * arrives on the same connection, and no client round trip is added.
 *
 * A failure here is not fatal: the page renders without `initial` and the client
 * hook fetches, which is also what surfaces the real error to the user rather
 * than replacing the whole page with one.
 */
export const dynamic = "force-dynamic"

const Board = async () => {
  const secret = process.env.SESSION_SECRET
  const token = secret
    ? await unseal(secret, (await cookies()).get(COOKIE)?.value)
    : undefined

  /* Opening the page used to cost a fetch here AND another from the client on
     mount. Through the cache the second one is free. */
  const initial = token
    ? ((await cached(token)) ??
      (await fetchInbox(token)
        .then(async (inbox) => {
          await remember(token, inbox)
          return inbox
        })
        .catch(() => undefined)))
    : undefined

  return <Inbox initial={initial} />
}

const Page = () => (
  <Suspense fallback={<Booting />}>
    <Board />
  </Suspense>
)

export default Page
