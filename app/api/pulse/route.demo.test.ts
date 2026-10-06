import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { COOKIE, seal } from "@/lib/auth"
import { DEMO_TOKEN } from "@/lib/demo"

/*
 * In demo the pulse serves a fixed fingerprint and GitHub hears nothing. The
 * session is a real sealed cookie holding the sentinel — not a mock of
 * `unseal` — so this also proves the sentinel travels the same cookie path
 * as a real token.
 */

const saved = { ...process.env }

const fetchPulse = vi.fn(async () => ({ fingerprint: "live" }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === COOKIE ? { value: globalThis.__demoSealed } : undefined,
  }),
}))
vi.mock("@/lib/github", () => ({
  fetchPulse: (...args: unknown[]) => fetchPulse(...(args as [])),
  GitHubError: class extends Error {},
}))

const { GET } = await import("./route")

describe("GET /api/pulse in demo", () => {
  beforeEach(async () => {
    process.env.YOUR_MOVE_DEMO = "1"
    process.env.SESSION_SECRET = "secret"
    globalThis.__demoSealed = await seal("secret", DEMO_TOKEN)
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it("serves the fixed fingerprint without asking GitHub", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ fingerprint: "demo" })
    expect(fetchPulse).not.toHaveBeenCalled()
  })

  /*
   * A real login beside demo mode reads as signed out: 401, and GitHub
   * hears nothing — the sealed real token never reaches `fetchPulse`.
   */
  it("answers 401 for a real token while demo holds, asking GitHub nothing", async () => {
    globalThis.__demoSealed = await seal("secret", "gho_realtoken")

    const response = await GET()

    expect(response.status).toBe(401)
    expect(fetchPulse).not.toHaveBeenCalled()
  })

  it("passes a real token through outside demo", async () => {
    delete process.env.YOUR_MOVE_DEMO
    delete process.env.VERCEL_ENV
    globalThis.__demoSealed = await seal("secret", "gho_realtoken")
    fetchPulse.mockResolvedValueOnce({ fingerprint: "live" })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(fetchPulse).toHaveBeenCalledWith("gho_realtoken")
    expect(await response.json()).toEqual({ fingerprint: "live" })
  })
})

declare global {
  // eslint-disable-next-line no-var
  var __demoSealed: string | undefined
}
