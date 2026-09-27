import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Inbox } from "@/lib/github"

/*
 * The deliberate refresh must reach GitHub.
 *
 * The server cache sat in front of every read, the pressed one included, so a
 * refresh within five minutes of the last fetch handed back the board already
 * on screen — same rows, same age — and the button looked broken. The poll is
 * still meant to be absorbed; only the person asking skips the read.
 */

const cachedInbox = {
  rows: [],
  failed: [],
  reasons: [],
  fetchedAt: 1,
} as unknown as Inbox
const liveInbox = {
  rows: [],
  failed: [],
  reasons: [],
  fetchedAt: 2,
} as unknown as Inbox

const fetchInbox = vi.fn(async () => liveInbox)
const cached = vi.fn(async () => cachedInbox)
const remember = vi.fn(async () => {})

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "sealed" }) }),
}))
vi.mock("@/lib/auth", () => ({ COOKIE: "c", unseal: async () => "token" }))
vi.mock("@/lib/cache", () => ({
  cached: (...args: unknown[]) => cached(...(args as [])),
  remember: (...args: unknown[]) => remember(...(args as [])),
  lastResort: async () => undefined,
}))
vi.mock("@/lib/github", () => ({
  fetchInbox: (...args: unknown[]) => fetchInbox(...(args as [])),
  GitHubError: class extends Error {},
}))

const { GET } = await import("./route")

describe("GET /api/inbox", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "secret"
    vi.clearAllMocks()
  })

  it("serves the cache to an automatic read", async () => {
    const body = await (
      await GET(new Request("http://x/api/inbox?done=7"))
    ).json()

    expect(body.fetchedAt).toBe(1)
    expect(fetchInbox).not.toHaveBeenCalled()
  })

  it("goes to GitHub for a deliberate refresh, and remembers the answer", async () => {
    const body = await (
      await GET(new Request("http://x/api/inbox?done=7&fresh=1"))
    ).json()

    expect(body.fetchedAt).toBe(2)
    expect(cached).not.toHaveBeenCalled()
    expect(remember).toHaveBeenCalledOnce()
  })
})
