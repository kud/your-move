import { describe, expect, it } from "vitest"

import { config as middlewareConfig } from "../middleware.js"
import manifest from "../app/manifest.js"

/*
 * The install surface is the one part of this app whose failures are silent.
 * A missing icon size, a gated manifest, a start_url pointing at a route the
 * gate refuses — none of them throw, none of them log, and none of them are
 * visible from a browser tab. The symptom is only ever "the Install option did
 * not appear", weeks later, on a phone.
 */

describe("manifest", () => {
  it("declares what a browser needs to offer an install", () => {
    const declared = manifest()

    expect(declared.display).toBe("standalone")
    expect(declared.start_url).toBe("/")
    /*
     * `short_name` is the one that has to be real: it is the launcher label.
     *
     * `name` is deliberately blank — it is the only text Chrome prints on its
     * own splash, which is painted before the page exists and therefore in a
     * face nothing of ours can set. Asserted rather than left as a curiosity,
     * because a blank name with no explanation is exactly what a later edit
     * helpfully repairs.
     */
    expect(declared.short_name).toBe("Your Move")
    expect(declared.name?.trim()).toBe("")

    /* 192 and 512 are the two Chrome actually requires; anything else is
       decoration. Asserted as a set so a resize that drops one fails here. */
    const sizes = new Set(declared.icons?.map((icon) => icon.sizes))
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
  })

  /* A plain icon declared maskable gets its mark shaved off by the launcher's
     crop; a maskable one declared plain sits in a box inside a box. Both look
     like a design mistake and neither is one. */
  it("keeps the maskable icon distinct from the plain ones", () => {
    const icons = manifest().icons ?? []
    const maskable = icons.filter((icon) => icon.purpose === "maskable")

    expect(maskable).toHaveLength(1)
    expect(icons.filter((icon) => !icon.purpose).length).toBeGreaterThan(0)
  })

  it("paints its own ground rather than borrowing the host's", () => {
    expect(manifest().background_color).toBe("#0b0c0e")
    expect(manifest().theme_color).toBe("#0b0c0e")
  })
})

/**
 * The paths the middleware's negative lookahead lets through, read back out of
 * the matcher itself rather than restated.
 */
const exclusions = (): string[] => {
  const [matcher] = middlewareConfig.matcher
  const inside = /\(\?!(.+?)\)/.exec(matcher)?.[1]

  if (!inside) throw new Error(`no negative lookahead in matcher: ${matcher}`)
  return inside.split("|")
}

describe("middleware matcher", () => {
  /*
   * Asserted as an exact set, in both directions on purpose.
   *
   * Missing an entry breaks the install silently. *Adding* one is the worse
   * half: the gate is default-deny by construction, and every exclusion is a
   * hole punched in it by hand. A new path appearing here should cost someone
   * a deliberate edit to this list, not slip through as a one-word diff.
   */
  it("lets through exactly the paths that carry nothing private", () => {
    expect(new Set(exclusions())).toEqual(
      new Set([
        "login",
        "api/auth",
        "api/version",
        "_next/static",
        "_next/image",
        "favicon.ico",
        "manifest.webmanifest",
        "icons/",
        "sw.js",
        "offline",
      ]),
    )
  })

  it("covers every file the service worker precaches", () => {
    /* Kept in step with `PRECACHE` in `public/sw.js`. A precache entry the gate
       refuses does not fail loudly — `addAll` rejects, the install never
       completes, and the app simply is never offline-capable. */
    const precached = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png"]
    const allowed = exclusions()

    for (const path of precached)
      expect(
        allowed.some((entry) => path.slice(1).startsWith(entry)),
        `${path} is behind the gate, so the service worker cannot precache it`,
      ).toBe(true)
  })
})
