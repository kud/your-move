import { afterEach, describe, expect, it } from "vitest"

import { DEMO_TOKEN, isDemo, isDemoSession } from "@/lib/demo"

/*
 * Demo mode is a deploy-time decision read off the environment, and the one
 * case that must never wobble is production: a stray flag on a real deploy
 * must not open the pretend login. Env is restored after each case because
 * these run in one process and leak sideways otherwise.
 */

const saved = { ...process.env }

afterEach(() => {
  process.env = { ...saved }
})

const setEnv = (env: Record<string, string | undefined>) => {
  delete process.env.VERCEL_ENV
  delete process.env.YOUR_MOVE_DEMO
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe("isDemo", () => {
  it("is false when nothing is set", () => {
    setEnv({})
    expect(isDemo()).toBe(false)
  })

  it("is true on a Vercel preview", () => {
    setEnv({ VERCEL_ENV: "preview" })
    expect(isDemo()).toBe(true)
  })

  it("is true with the flag on a non-production deploy", () => {
    setEnv({ YOUR_MOVE_DEMO: "1", VERCEL_ENV: "development" })
    expect(isDemo()).toBe(true)
  })

  it("is true with the flag and no Vercel env at all", () => {
    setEnv({ YOUR_MOVE_DEMO: "1" })
    expect(isDemo()).toBe(true)
  })

  it("is false in production even with the flag set", () => {
    setEnv({ YOUR_MOVE_DEMO: "1", VERCEL_ENV: "production" })
    expect(isDemo()).toBe(false)
  })

  it("is false in production without the flag", () => {
    setEnv({ VERCEL_ENV: "production" })
    expect(isDemo()).toBe(false)
  })

  it("is false for any other flag value", () => {
    setEnv({ YOUR_MOVE_DEMO: "true" })
    expect(isDemo()).toBe(false)
  })
})

describe("isDemoSession", () => {
  it("honours the sentinel only while demo mode holds", () => {
    setEnv({ YOUR_MOVE_DEMO: "1" })
    expect(isDemoSession(DEMO_TOKEN)).toBe(true)

    setEnv({ VERCEL_ENV: "production" })
    expect(isDemoSession(DEMO_TOKEN)).toBe(false)
  })

  it("never honours a real-looking token", () => {
    setEnv({ YOUR_MOVE_DEMO: "1" })
    expect(isDemoSession("gho_sometoken")).toBe(false)
    expect(isDemoSession(undefined)).toBe(false)
  })
})
