import { cookies } from "next/headers"

import { Inbox } from "@/components/inbox"
import { COOKIE, unseal } from "@/lib/auth"
import { fetchInbox } from "@/lib/github"

/*
 * Fetched on the server for the first paint, then the client takes over polling.
 *
 * The alternative — an empty shell that fetches on mount — costs a visible
 * spinner on every open, and this is a board you glance at for ten seconds. The
 * first answer should already be on screen.
 *
 * A failure here is not fatal: the page renders without `initial` and the client
 * hook fetches, which is also what surfaces the real error to the user rather
 * than replacing the whole page with one.
 */
export const dynamic = "force-dynamic"

const Page = async () => {
  const secret = process.env.SESSION_SECRET
  const token = secret
    ? await unseal(secret, (await cookies()).get(COOKIE)?.value)
    : undefined

  const initial = token
    ? await fetchInbox(token).catch(() => undefined)
    : undefined

  return <Inbox initial={initial} />
}

export default Page
