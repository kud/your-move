import { afterEach, describe, expect, it } from "vitest"

import { COOKIE, unseal } from "@/lib/auth"
import { DEMO_FALLBACK_SECRET, DEMO_TOKEN } from "@/lib/demo"

/*
 * The login route has two halves now: the OAuth dance, and the demo's
 * pretended one. Production must still send the browser to GitHub and seal
 * nothing; demo must seal the sentinel and go straight to `to`, with the same
 * path-only rule the callback enforces on the way back.
 */

const saved = { ...process.env }

afterEach(() => {
  process.env = { ...saved }
})

const setEnv = (env: Record<string, string | undefined>) => {
  for (const key of [
    "VERCEL_ENV",
    "YOUR_MOVE_DEMO",
    "SESSION_SECRET",
    "GITHUB_CLIENT_ID",
  ])
    delete process.env[key]
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value
  }
}

const { GET } = await import("./route")

const locationOf = (response: Response): string =>
  response.headers.get("location") ?? ""

describe("GET /api/auth/login", () => {
  it("sends production to GitHub and seals nothing", async () => {
    setEnv({
      VERCEL_ENV: "production",
      SESSION_SECRET: "secret",
      GITHUB_CLIENT_ID: "id",
    })

    const response = await GET(new Request("http://x/api/auth/login?to=/foo"))

    expect(locationOf(response)).toMatch(
      /^https:\/\/github\.com\/login\/oauth\/authorize/,
    )
    expect(response.cookies.get(COOKIE)).toBeUndefined()
  })

  it("signs demo straight in with the sentinel", async () => {
    setEnv({ YOUR_MOVE_DEMO: "1", SESSION_SECRET: "secret" })

    const response = await GET(new Request("http://x/api/auth/login?to=/foo"))

    expect(new URL(locationOf(response)).pathname).toBe("/foo")
    const sealed = response.cookies.get(COOKIE)?.value
    expect(sealed).toBeDefined()
    expect(await unseal("secret", sealed)).toBe(DEMO_TOKEN)
  })

  it("signs demo in with the fallback secret when none is set", async () => {
    setEnv({ YOUR_MOVE_DEMO: "1" })

    const response = await GET(new Request("http://x/api/auth/login"))

    expect(response.status).toBe(303)
    const sealed = response.cookies.get(COOKIE)?.value
    expect(await unseal(DEMO_FALLBACK_SECRET, sealed)).toBe(DEMO_TOKEN)
  })

  it("refuses an absolute `to` in demo, like the callback does", async () => {
    setEnv({ YOUR_MOVE_DEMO: "1", SESSION_SECRET: "secret" })

    for (const to of ["https://evil.example", "//evil.example"]) {
      const response = await GET(
        new Request(`http://x/api/auth/login?to=${encodeURIComponent(to)}`),
      )
      expect(new URL(locationOf(response)).pathname).toBe("/")
    }
  })
})
