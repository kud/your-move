"use client"

import { useCallback, useEffect, useState } from "react"

/*
 * Whether the app on screen is the app that is deployed.
 *
 * An installed PWA resumed from the background never re-requests its document,
 * and this one refreshes its DATA every ten minutes — so it can hold a bundle
 * for days while looking perfectly alive. A board that is old and busy is
 * indistinguishable from a board that is current, right up until you chase a
 * bug that was only an old build. That happened, and cost twenty minutes.
 *
 * The comparison is exact rather than heuristic: `NEXT_PUBLIC_COMMIT` is baked
 * in at build time, so the client carries the commit it was built from, and
 * `/api/version` returns the same constant from whatever is deployed now.
 *
 * Not the service worker's `updatefound`, which was the obvious mechanism and
 * the wrong one: the worker only changes when `sw.js` changes, and `sw.js`
 * changes almost never. It would have been silent through every deployment this
 * is meant to catch.
 */

const MINE = process.env.NEXT_PUBLIC_COMMIT ?? ""

/* Cheap enough to ask often, and rare enough not to matter: a few bytes against
   a poll that already runs. Aligned with it rather than on its own timer. */
const EVERY_MS = 10 * 60 * 1000

export const useUpdate = () => {
  const [live, setLive] = useState(MINE)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    /* Nothing to compare against on a local build, where there is no deployment
       to be behind. */
    if (!MINE) return
    setChecking(true)
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return
      const { commit } = (await response.json()) as { commit?: string }
      if (commit) setLive(commit)
    } catch {
      /* Offline, or the deployment is mid-swap. Staying quiet is right: the
         honest answer to "am I current" when you cannot ask is nothing, not a
         warning. */
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void check()

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check()
    }, EVERY_MS)

    /* Coming back is the moment a deployment is most likely to have happened
       while you were away, and the moment you are about to act on what you
       see. */
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [check])

  /*
   * Everything the worker holds, then a real navigation.
   *
   * A plain reload would very nearly do — navigations are network-first and the
   * static assets are content-hashed, so a new build has new paths. "Very
   * nearly" is the problem: this button exists for the case where something has
   * gone wrong in a way nobody has diagnosed, so it should be the heaviest
   * honest hammer rather than the most elegant one.
   */
  const upgrade = useCallback(async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {}

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    } catch {}

    /* `location.reload()` can be served from the back/forward cache in some
       browsers; assigning the URL cannot. */
    location.replace(location.pathname + location.search)
  }, [])

  return { stale: Boolean(MINE) && live !== MINE, checking, check, upgrade }
}
