import { beforeEach, describe, expect, it, vi } from "vitest"

/*
 * The pulse route is thin, and the two things it must not get wrong are the
 * two the client acts on: a revoked session has to arrive as a 401, because
 * that is the one pulse failure that is not silent, and nothing may be served
 * from a cache, because a cached pulse confirms its own echo.
 */

class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const fetchPulse = vi.fn()
let session: string | undefined = "token"

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "sealed" }) }),
}))
vi.mock("@/lib/auth", () => ({ COOKIE: "c", unseal: async () => session }))
vi.mock("@/lib/github", () => ({
  fetchPulse: (...args: unknown[]) => fetchPulse(...args),
  GitHubError,
}))

const { GET } = await import("./route")

describe("GET /api/pulse", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "secret"
    session = "token"
    vi.clearAllMocks()
  })

  it("returns the fingerprint and budget, never cached", async () => {
    fetchPulse.mockResolvedValue({
      fingerprint: "f",
      budget: { remaining: 4200 },
    })
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toEqual({
      fingerprint: "f",
      budget: { remaining: 4200 },
    })
    expect(fetchPulse).toHaveBeenCalledWith("token")
  })

  it("answers 401 without a session, and asks GitHub nothing", async () => {
    session = undefined
    const response = await GET()

    expect(response.status).toBe(401)
    expect(fetchPulse).not.toHaveBeenCalled()
  })

  it("passes GitHub's 401 through", async () => {
    fetchPulse.mockRejectedValue(new GitHubError("token rejected", 401))
    expect((await GET()).status).toBe(401)
  })

  it("reports any other failure as not-ok", async () => {
    fetchPulse.mockRejectedValue(new Error("boom"))
    const response = await GET()

    expect(response.status).toBe(502)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
