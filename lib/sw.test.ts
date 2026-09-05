import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/*
 * The worker's caching policy, asserted rather than reasoned about.
 *
 * A service worker is the one piece of this app that keeps data on a device
 * after the session that authorised it is gone, and it is also the one piece
 * with no type checker, no import graph and no way to observe it in a review —
 * it runs in a separate thread, on a device, on whatever version it installed.
 *
 * So the rule that matters ("board data is never cached") is asserted here by
 * loading the actual file and driving its handlers, rather than trusted to a
 * comment inside it.
 */

const source = readFileSync(
  fileURLToPath(new URL("../public/sw.js", import.meta.url)),
  "utf8",
)

const ORIGIN = "https://co.example"

/** A worker global with just enough of the platform for the file to run. */
const load = ({ network: reachable = true } = {}) => {
  const handlers = new Map<string, (event: unknown) => void>()
  const stored = new Map<string, string>()

  const cache = {
    match: async (request: { url: string }) =>
      stored.has(request.url) ? { url: request.url } : undefined,
    put: async (request: { url: string }) => void stored.set(request.url, "x"),
    addAll: async (paths: string[]) => {
      for (const path of paths) stored.set(`${ORIGIN}${path}`, "x")
    },
  }

  const self_ = {
    location: { origin: ORIGIN },
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      void handlers.set(name, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    registration: {},
  }

  const caches_ = {
    open: async () => cache,
    keys: async () => [...new Set(["co-shell-v1"])],
    delete: async () => true,
    match: async (path: string) =>
      stored.has(`${ORIGIN}${path}`) ? { url: `${ORIGIN}${path}` } : undefined,
  }

  const fetched: string[] = []
  const network = async (request: { url: string }) => {
    fetched.push(request.url)
    if (!reachable) throw new TypeError("Failed to fetch")
    return { ok: true, type: "basic", clone: () => ({}), url: request.url }
  }

  new Function(
    "self",
    "caches",
    "fetch",
    "URL",
    "Response",
    source,
  )(self_, caches_, network, URL, { error: () => ({ error: true }) })

  return { handlers, stored, fetched }
}

/**
 * What the worker did with one request: the response it committed to, or
 * `null` when it declined and left the request to the browser.
 */
const handle = async (
  handlers: Map<string, (event: unknown) => void>,
  request: { url: string; method?: string; mode?: string },
) => {
  let taken: Promise<unknown> | null = null

  handlers.get("fetch")?.({
    request: { method: "GET", mode: "no-cors", ...request },
    respondWith: (value: Promise<unknown>) => void (taken = value),
  })

  return taken === null ? null : await taken
}

describe("the shell worker", () => {
  it("precaches the shell and nothing else", async () => {
    const { handlers, stored } = load()
    const install = handlers.get("install")

    let waited: Promise<unknown> | null = null
    install?.({ waitUntil: (value: Promise<unknown>) => void (waited = value) })
    await waited

    expect([...stored.keys()].map((url) => url.replace(ORIGIN, ""))).toEqual([
      "/offline",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
    ])
  })

  /*
   * The one that matters. Every one of these carries board state, and a cached
   * copy of any of them outlives the cookie that gated it — which is the only
   * way a service worker hands a private board to someone the gate refused.
   */
  it.each([
    "/api/stream",
    "/api/mission?company=acme&ref=%2312",
    "/?_rsc=1a2b3c",
    "/mission/acme/12?_rsc=1a2b3c",
  ])("declines %s rather than caching it", async (path) => {
    const { handlers } = load()

    expect(await handle(handlers, { url: `${ORIGIN}${path}` })).toBeNull()
  })

  it("serves hashed build assets from the cache", async () => {
    const { handlers, fetched } = load()
    const asset = { url: `${ORIGIN}/_next/static/chunks/abc123.js` }

    await handle(handlers, asset)
    expect(fetched).toEqual([asset.url])

    /* Second time round it must not reach the network at all — that is the
       whole point of caching something whose name already contains its hash. */
    await handle(handlers, asset)
    expect(fetched).toEqual([asset.url])
  })

  it("answers a navigation from the network while there is one", async () => {
    const { handlers, fetched } = load()

    const response = await handle(handlers, {
      url: `${ORIGIN}/`,
      mode: "navigate",
    })

    /* Never stale-while-revalidate: "what needs me right now" must not come
       from a cache while a network exists. */
    expect(fetched).toEqual([`${ORIGIN}/`])
    expect(response).toMatchObject({ url: `${ORIGIN}/` })
  })

  it("falls back to the offline page when the network is gone", async () => {
    const { handlers, stored } = load({ network: false })
    stored.set(`${ORIGIN}/offline`, "x")

    const response = await handle(handlers, {
      url: `${ORIGIN}/`,
      mode: "navigate",
    })

    /* The offline page, and never a cached board — the fallback says the board
       is unreachable rather than showing yesterday's, which at exactly this
       moment would be indistinguishable from today's. */
    expect(response).toMatchObject({ url: `${ORIGIN}/offline` })
  })

  it("leaves a POST alone", async () => {
    const { handlers } = load()

    expect(
      await handle(handlers, { url: `${ORIGIN}/api/auth`, method: "POST" }),
    ).toBeNull()
  })

  it("leaves another origin alone", async () => {
    const { handlers } = load()

    expect(
      await handle(handlers, { url: "https://api.github.com/repos/kud/x" }),
    ).toBeNull()
  })
})
