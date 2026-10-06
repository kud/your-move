import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { COOKIE, seal } from "@/lib/auth"
import { DEMO_TOKEN } from "@/lib/demo"
import { demoRows } from "@/lib/demo-fixtures"

/*
 * In demo the inbox serves fixtures and GitHub hears nothing. The session is
 * a real sealed cookie holding the sentinel — not a mock of `unseal` — so
 * this also proves the sentinel travels the same cookie path as a real token.
 */

const saved = { ...process.env }

const fetchInbox = vi.fn(async () => {
  throw new Error("must not reach GitHub in demo")
})

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === COOKIE ? { value: globalThis.__demoSealed } : undefined,
  }),
}))
vi.mock("@/lib/github", () => ({
  fetchInbox: (...args: unknown[]) => fetchInbox(...(args as [])),
  GitHubError: class extends Error {},
}))

const { GET } = await import("./route")

describe("GET /api/inbox in demo", () => {
  beforeEach(async () => {
    process.env.YOUR_MOVE_DEMO = "1"
    process.env.SESSION_SECRET = "secret"
    globalThis.__demoSealed = await seal("secret", DEMO_TOKEN)
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it("serves the fixtures without asking GitHub", async () => {
    const body = await (await GET(new Request("http://x/api/inbox"))).json()

    expect(body.rows).toHaveLength(demoRows.length)
    expect(body.login).toBe("alex-dev")
    expect(fetchInbox).not.toHaveBeenCalled()
  })
})

declare global {
  // eslint-disable-next-line no-var
  var __demoSealed: string | undefined
}
