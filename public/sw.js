/*
 * The shell, and nothing else.
 *
 * The board is per-request and access-controlled, so it is never cached — not
 * as HTML, not as an RSC payload, not as an API response. A cache that held it
 * would outlive the session cookie that gated it, which is the one way a
 * service worker can hand a private board to someone the middleware refused.
 *
 * What is cached is the part that carries no information: hashed build assets,
 * the icons, the manifest, and a static offline page. Losing all of it costs a
 * download; leaking any of it costs nothing at all.
 *
 * Hand-written rather than generated. The whole policy is three rules and they
 * are all security-relevant — a build step that emits a caching strategy from a
 * config file puts the one thing worth reading behind a plugin's defaults.
 */

/* Bumping this is how a shell change ships: `activate` deletes every cache that
   is not this one, so the old assets go with it. */
const SHELL = "co-shell-v1"

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      /* `skipWaiting` only after the precache resolves. Activating first would
         claim the page with a cache that may have failed halfway, and the
         failure would surface later as a blank offline screen. */
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== SHELL).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Immutable by construction (content-hashed) or by nature (the app's own icons). */
const isShellAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/manifest.webmanifest"

const cacheFirst = async (request) => {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  /* Only a clean same-origin 200 is worth keeping. Caching an opaque or errored
     response pins the failure until the next version bump. */
  if (response.ok && response.type === "basic")
    cache.put(request, response.clone())

  return response
}

/*
 * Network first, and the cache only when the network is gone.
 *
 * Not stale-while-revalidate: the answer to "what needs me right now" must
 * never come from a cache when a network is available, and the offline page is
 * a fallback rather than a stale board — it says the board is unreachable
 * instead of showing yesterday's.
 */
const navigateOrOffline = async (request) => {
  try {
    return await fetch(request)
  } catch {
    return (await caches.match("/offline")) ?? Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  /* A POST is the login form or a mutation; neither has a cached answer, and a
     cross-origin request is not ours to serve. Left alone, they take the
     browser's own path as though no worker were installed. */
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(navigateOrOffline(request))
    return
  }

  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  /*
   * Everything left is board data: `/api/*`, the SSE stream, and the RSC
   * payloads a client navigation fetches. Deliberately not handled — falling
   * through leaves the stream unbuffered and keeps private responses out of
   * every cache this worker owns.
   */
})
