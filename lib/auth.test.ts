import { describe, expect, it } from "vitest"

import { issueState, readState, safePath } from "@/lib/auth"

/*
 * The post-login destination is attacker-supplied: it rides in on `?to=` and
 * comes back out of `state`. Every rejected case below resolves somewhere
 * other than this origin, or would after one more decode, so each must
 * collapse to "/"; every kept case is a path the app itself produces.
 */

const rejected = [
  "/\\evil.example",
  "/\t/evil.example",
  "/\n/evil.example",
  "//evil.example",
  "https://evil.example",
  "/%2F%2Fevil.example",
  "/%5Cevil.example",
  "javascript:alert(1)",
]

const kept = ["/", "/inbox?x=1#y", "/a/deep/path/to/somewhere"]

describe("safePath", () => {
  it.each(rejected)("refuses %j", (to) => {
    expect(safePath(to)).toBe("/")
  })

  it.each(kept)("keeps %j", (to) => {
    expect(safePath(to)).toBe(to)
  })

  it("falls back to / for anything that is not a string", () => {
    expect(safePath(undefined)).toBe("/")
    expect(safePath(null)).toBe("/")
    expect(safePath(42)).toBe("/")
  })
})

describe("readState", () => {
  it.each(rejected)("lands on / when the state carries %j", async (to) => {
    const state = await issueState("secret", to)
    expect(await readState("secret", state, Date.now())).toBe("/")
  })

  it.each(kept)("lands on %j when the state carries it", async (to) => {
    const state = await issueState("secret", to)
    expect(await readState("secret", state, Date.now())).toBe(to)
  })
})
